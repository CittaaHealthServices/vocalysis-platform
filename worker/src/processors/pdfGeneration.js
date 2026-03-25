const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

module.exports = async function pdfGenerationProcessor(job) {
  const { sessionId, tenantId, requestedBy } = job.data;

  try {
    logger.info('Starting PDF generation for session %s', sessionId);
    job.progress(10);

    const Session = require('../models/Session');
    const Employee = require('../models/Employee');
    const Tenant = require('../models/Tenant');

    // Step 1: Fetch session with populated references
    logger.info('Step 1: Fetching session data');
    job.progress(15);

    const sessionDoc = await Session.findById(sessionId)
      .populate('patientId')
      .populate('clinicianId')
      .populate('tenantId');

    if (!sessionDoc) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!sessionDoc.analysisResults) {
      throw new Error(`Session ${sessionId} has no analysis results`);
    }

    logger.info('Session data fetched successfully');

    // Step 2: Generate PDF using pdfkit
    logger.info('Step 2: Generating PDF document');
    job.progress(30);

    const storageDir = path.join('/app/storage/reports', tenantId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const pdfPath = path.join(storageDir, `${sessionId}.pdf`);
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 50,
      size: 'A4'
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Header with Cittaa branding
    doc.fontSize(24).font('Helvetica-Bold').text('Vocalysis Assessment Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Powered by Cittaa', { align: 'center' });
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown(1);

    // Report metadata
    doc.fontSize(11).font('Helvetica-Bold').text('Report Information');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Report ID: ${sessionId}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Assessment Date: ${sessionDoc.createdAt.toLocaleString()}`);
    doc.moveDown(0.5);

    // Subject information
    doc.fontSize(11).font('Helvetica-Bold').text('Subject Information');
    doc.fontSize(10).font('Helvetica');
    const patientName = sessionDoc.patientId ? sessionDoc.patientId.fullName : 'Unknown';
    const patientId = sessionDoc.patientId ? sessionDoc.patientId.employeeId : 'N/A';
    doc.text(`Name: ${patientName}`);
    doc.text(`Employee ID: ${patientId}`);
    doc.text(`Department: ${sessionDoc.patientId ? sessionDoc.patientId.departmentId : 'N/A'}`);
    doc.moveDown(0.5);

    // Analysis results
    doc.fontSize(11).font('Helvetica-Bold').text('Analysis Results');
    doc.fontSize(10).font('Helvetica');
    const riskLevel = sessionDoc.analysisResults.overallRiskLevel || 'unknown';
    const confidence = sessionDoc.analysisResults.confidence
      ? `${(sessionDoc.analysisResults.confidence * 100).toFixed(2)}%`
      : 'N/A';
    doc.text(`Overall Risk Level: ${riskLevel.toUpperCase()}`);
    doc.text(`Confidence Score: ${confidence}`);
    doc.moveDown(0.5);

    // Features analysis
    if (sessionDoc.analysisResults.features && Object.keys(sessionDoc.analysisResults.features).length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Extracted Features');
      doc.fontSize(10).font('Helvetica');
      Object.entries(sessionDoc.analysisResults.features).forEach(([key, value]) => {
        const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
        doc.text(`${key}: ${displayValue}`);
      });
      doc.moveDown(0.5);
    }

    // Clinician information
    if (sessionDoc.clinicianId) {
      doc.fontSize(11).font('Helvetica-Bold').text('Clinician Information');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Clinician: ${sessionDoc.clinicianId.fullName}`);
      doc.text(`Specialization: ${sessionDoc.clinicianId.specialization || 'Not specified'}`);
      doc.moveDown(0.5);
    }

    // Recommendations based on risk level
    doc.fontSize(11).font('Helvetica-Bold').text('Recommendations');
    doc.fontSize(10).font('Helvetica');
    const recommendations = {
      critical: [
        'Immediate medical evaluation recommended',
        'Contact mental health professional within 24 hours',
        'Consider hospitalization if symptoms escalate',
        'Notify emergency contacts immediately'
      ],
      high: [
        'Schedule consultation with healthcare provider',
        'Consider cognitive behavioral therapy',
        'Increase monitoring frequency',
        'Maintain regular assessment schedule'
      ],
      medium: [
        'Routine follow-up assessment recommended',
        'Maintain healthy lifestyle practices',
        'Regular wellness monitoring',
        'Continue current assessment schedule'
      ],
      normal: [
        'Continue regular wellness activities',
        'Maintain current assessment schedule',
        'No immediate intervention required',
        'Monitor for any changes in condition'
      ]
    };

    const riskRecs = recommendations[riskLevel] || recommendations.normal;
    riskRecs.forEach(rec => doc.text(`• ${rec}`));
    doc.moveDown(1);

    // Footer
    doc.fontSize(8).font('Helvetica').text(
      'This report is confidential and intended for authorized personnel only. ' +
        'It should not be shared without proper consent from the subject.',
      { align: 'left' }
    );
    doc.text(
      `Report generated by Vocalysis Platform 2.0 | Tenant: ${tenantId} | Requested by: ${requestedBy}`,
      { align: 'center' }
    );

    doc.end();

    // Wait for stream to finish
    logger.info('Step 3: Saving PDF to storage');
    job.progress(60);

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    logger.info('PDF saved to %s', pdfPath);

    // Step 4: Update Session document
    logger.info('Step 4: Updating session document');
    job.progress(80);

    sessionDoc.reportPdfKey = pdfPath;
    sessionDoc.reportStatus = 'finalised';
    sessionDoc.reportGeneratedAt = new Date();
    sessionDoc.reportGeneratedBy = requestedBy;
    await sessionDoc.save();

    logger.info('Session document updated with PDF reference');

    job.progress(100);
    logger.info('PDF generation completed for session %s', sessionId);

    return {
      sessionId,
      pdfPath,
      status: 'success',
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('PDF generation failed for session %s: %s', sessionId, error.message);
    throw error;
  }
};
