/**
 * Vocalysis Platform — MongoDB Index Migration
 * Run once after initial deployment:
 * node infra/migrations/001_create_indexes.js
 */
require('dotenv').config({ path: './api/.env' });
const mongoose = require('mongoose');

async function createIndexes() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('Creating indexes...');

  // User indexes
  await db.collection('users').createIndex({ tenantId: 1, email: 1 }, { unique: true });
  await db.collection('users').createIndex({ tenantId: 1, role: 1 });
  await db.collection('users').createIndex({ userId: 1 }, { unique: true });

  // Employee indexes
  await db.collection('employees').createIndex({ tenantId: 1, departmentId: 1 });
  await db.collection('employees').createIndex({ tenantId: 1, status: 1 });
  await db.collection('employees').createIndex({ tenantId: 1, userId: 1 }, { unique: true });
  await db.collection('employees').createIndex({ tenantId: 1, email: 1 });
  await db.collection('employees').createIndex({ tenantId: 1, managerId: 1 }); // Phase 2: Manager view

  // Session indexes
  await db.collection('sessions').createIndex({ tenantId: 1, sessionDate: -1 });
  await db.collection('sessions').createIndex({ tenantId: 1, patientId: 1, sessionDate: -1 });
  await db.collection('sessions').createIndex({ tenantId: 1, 'vocacoreResults.overallRiskLevel': 1 });

  // Alert indexes
  await db.collection('alerts').createIndex({ tenantId: 1, status: 1, triggeredAt: -1 });
  await db.collection('alerts').createIndex({ tenantId: 1, employeeId: 1 });

  // AuditLog indexes
  await db.collection('auditlogs').createIndex({ tenantId: 1, timestamp: -1 });
  await db.collection('auditlogs').createIndex({ userId: 1, timestamp: -1 });

  // ApiKey index
  await db.collection('apikeys').createIndex({ keyHash: 1 }, { unique: true });

  // HealthCheckLog index
  await db.collection('healthchecklogs').createIndex({ service: 1, checkedAt: -1 });

  // Consultation indexes
  await db.collection('consultations').createIndex({ tenantId: 1, scheduledAt: -1 });
  await db.collection('consultations').createIndex({ tenantId: 1, employeeId: 1 });
  await db.collection('consultations').createIndex({ tenantId: 1, clinicianId: 1 });

  // Tenant index
  await db.collection('tenants').createIndex({ tenantId: 1 }, { unique: true });
  await db.collection('tenants').createIndex({ status: 1 });

  console.log('✅ All indexes created successfully');
  await mongoose.disconnect();
}

createIndexes().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
