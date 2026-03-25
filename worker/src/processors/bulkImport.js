const { parse } = require('csv-parse');
const logger = require('../logger');

module.exports = async function bulkImportProcessor(job) {
  const { tenantId, csvBuffer, batchId, addedBy } = job.data;
  let total = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  try {
    logger.info('Starting bulk employee import (batchId: %s, tenantId: %s)', batchId, tenantId);
    job.progress(5);

    const Employee = require('../models/Employee');
    const Tenant = require('../models/Tenant');
    const BulkImportLog = require('../models/BulkImportLog');
    const { queues } = require('../worker');
    const Redis = require('ioredis');

    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Step 1: Parse CSV
    logger.info('Step 1: Parsing CSV data');
    job.progress(10);

    const csvData = Buffer.from(csvBuffer, 'base64').toString('utf-8');
    const rows = [];

    await new Promise((resolve, reject) => {
      parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false
      })
        .on('readable', function () {
          let record;
          while ((record = this.read()) !== null) {
            rows.push(record);
          }
        })
        .on('error', reject)
        .on('end', resolve);
    });

    total = rows.length;
    logger.info('CSV parsed: %d rows found', total);
    job.progress(20);

    // Step 2: Validate required columns
    logger.info('Step 2: Validating CSV structure');
    job.progress(25);

    const requiredColumns = ['employeeId', 'fullName', 'email', 'departmentId', 'jobTitle', 'dateOfJoining'];
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }
    }

    logger.info('CSV structure validation passed');

    // Step 3 & 4: Validate and insert employees
    logger.info('Step 3-4: Processing employee records');
    job.progress(30);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const employeeBatch = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Validate email format
        if (!emailRegex.test(row.email)) {
          errors.push({
            row: i + 2,
            employeeId: row.employeeId,
            error: 'Invalid email format'
          });
          skipped++;
          continue;
        }

        // Validate required fields are not empty
        const emptyFields = requiredColumns.filter(col => !row[col] || row[col].trim() === '');
        if (emptyFields.length > 0) {
          errors.push({
            row: i + 2,
            employeeId: row.employeeId,
            error: `Missing required fields: ${emptyFields.join(', ')}`
          });
          skipped++;
          continue;
        }

        // Check for duplicate email within same tenant
        const existingEmployee = await Employee.findOne({
          tenantId,
          email: row.email.trim().toLowerCase()
        });

        if (existingEmployee) {
          errors.push({
            row: i + 2,
            employeeId: row.employeeId,
            error: 'Email already exists for this tenant'
          });
          skipped++;
          continue;
        }

        // Validate date format
        const dateOfJoining = new Date(row.dateOfJoining);
        if (isNaN(dateOfJoining.getTime())) {
          errors.push({
            row: i + 2,
            employeeId: row.employeeId,
            error: 'Invalid date of joining format (use YYYY-MM-DD or ISO format)'
          });
          skipped++;
          continue;
        }

        // Prepare employee document
        const employeeDoc = {
          tenantId,
          employeeId: row.employeeId.trim(),
          fullName: row.fullName.trim(),
          email: row.email.trim().toLowerCase(),
          departmentId: row.departmentId.trim(),
          jobTitle: row.jobTitle.trim(),
          dateOfJoining: dateOfJoining,
          importBatchId: batchId,
          addedBy,
          createdAt: new Date(),
          status: 'active',
          wellnessProfile: {
            consentActive: false,
            currentRiskLevel: 'unknown',
            totalAssessments: 0
          }
        };

        // Add optional fields if provided
        if (row.phone) employeeDoc.phone = row.phone.trim();
        if (row.dateOfBirth) {
          const dob = new Date(row.dateOfBirth);
          if (!isNaN(dob.getTime())) {
            employeeDoc.dateOfBirth = dob;
          }
        }
        if (row.gender) employeeDoc.gender = row.gender.trim();
        if (row.location) employeeDoc.location = row.location.trim();

        employeeBatch.push(employeeDoc);

        // Insert in batches of 50
        if (employeeBatch.length >= 50) {
          logger.info('Inserting batch of %d employees', employeeBatch.length);
          try {
            const result = await Employee.insertMany(employeeBatch, { ordered: false });
            inserted += result.length;
            employeeBatch.length = 0;
          } catch (batchError) {
            // Handle partial failures in batch
            if (batchError.writeErrors) {
              inserted += employeeBatch.length - batchError.writeErrors.length;
              failed += batchError.writeErrors.length;
              batchError.writeErrors.forEach(err => {
                errors.push({
                  row: i + 2,
                  error: err.err.op.employeeId + ' - ' + (err.err.errmsg || 'Unknown error')
                });
              });
            } else {
              failed += employeeBatch.length;
              errors.push({
                row: i + 2,
                error: batchError.message
              });
            }
            employeeBatch.length = 0;
          }

          const progressPercent = 30 + Math.floor(((i + 1) / total) * 65);
          job.progress(progressPercent);
        }
      } catch (rowError) {
        logger.warn('Error processing row %d: %s', i + 2, rowError.message);
        failed++;
        errors.push({
          row: i + 2,
          employeeId: row.employeeId,
          error: rowError.message
        });
      }
    }

    // Insert remaining batch
    if (employeeBatch.length > 0) {
      logger.info('Inserting final batch of %d employees', employeeBatch.length);
      try {
        const result = await Employee.insertMany(employeeBatch, { ordered: false });
        inserted += result.length;
      } catch (batchError) {
        if (batchError.writeErrors) {
          inserted += employeeBatch.length - batchError.writeErrors.length;
          failed += batchError.writeErrors.length;
          batchError.writeErrors.forEach(err => {
            errors.push({
              error: err.err.op.employeeId + ' - ' + (err.err.errmsg || 'Unknown error')
            });
          });
        } else {
          failed += employeeBatch.length;
          errors.push({
            error: batchError.message
          });
        }
      }
    }

    job.progress(95);

    // Step 5: Store import result in Redis
    logger.info('Step 5: Storing import result in Redis');

    const importResult = {
      batchId,
      tenantId,
      total,
      inserted,
      skipped,
      failed,
      errors: errors.slice(0, 100), // Keep first 100 errors only
      completedAt: new Date(),
      status: failed === 0 ? 'completed' : 'completed_with_errors'
    };

    await redis.setex(`import-result:${batchId}`, 7 * 24 * 60 * 60, JSON.stringify(importResult));

    // Store in MongoDB for persistence
    await BulkImportLog.create({
      batchId,
      tenantId,
      total,
      inserted,
      skipped,
      failed,
      errorCount: errors.length,
      addedBy,
      completedAt: new Date(),
      status: failed === 0 ? 'completed' : 'completed_with_errors'
    });

    logger.info('Import result stored (batchId: %s, inserted: %d, skipped: %d, failed: %d)', batchId, inserted, skipped, failed);

    // Step 6: Send summary email to HR Admin
    logger.info('Step 6: Sending summary email to HR Admin');

    const hrAdmin = await Employee.findOne({
      tenantId,
      role: 'HR_ADMIN',
      addedBy: addedBy
    });

    if (hrAdmin && hrAdmin.email) {
      await queues.emailNotifications.add(
        {
          type: 'bulk_import_summary',
          to: hrAdmin.email,
          templateData: {
            hrAdminName: hrAdmin.fullName,
            batchId,
            total,
            inserted,
            skipped,
            failed,
            completionPercentage: Math.round((inserted / total) * 100),
            timestamp: new Date(),
            summaryLink: `${process.env.API_BASE_URL || 'https://api.vocalysis.cittaa.in'}/v1/import/${batchId}/summary`
          }
        },
        { jobId: `import-summary-${batchId}` }
      );
      logger.info('Summary email queued for HR Admin');
    }

    job.progress(100);
    logger.info('Bulk import completed (batchId: %s)', batchId);

    redis.disconnect();

    return {
      batchId,
      total,
      inserted,
      skipped,
      failed,
      status: importResult.status,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Bulk import failed (batchId: %s): %s', batchId, error.message);
    throw error;
  }
};
