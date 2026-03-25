const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

class PDFGenerator {
  /**
   * Generate session report PDF
   */
  async generateSessionReport(session, patient, clinician, tenant) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);

        // Header with Cittaa logo/branding
        this._addHeader(doc, tenant);

        // Patient information (anonymized per settings)
        this._addPatientInfo(doc, patient, session);

        // VocaCore scores with visualizations
        this._addVocaCoreScores(doc, session.vocacoreResults);

        // Biomarker findings
        this._addBiomarkerFindings(doc, session.vocacoreResults);

        // Clinical flags
        this._addClinicalFlags(doc, session.vocacoreResults);

        // Clinician notes
        if (session.clinicianNotes) {
          this._addCliniciannNotes(doc, session.clinicianNotes);
        }

        // Recommendations
        this._addRecommendations(doc, session.vocacoreResults);

        // Footer
        this._addFooter(doc);

        // Finalize
        doc.end();
      } catch (err) {
        logger.error('Failed to generate session report', { error: err.message });
        reject(new Error('Failed to generate report PDF'));
      }
    });
  }

  /**
   * Generate HR analytics report PDF
   */
  async generateHRReport(analytics, tenant, dateRange) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);

        // Header
        this._addHeader(doc, tenant);

        // Report metadata
        doc.fontSize(12).font('Helvetica-Bold').text('Wellness Analytics Report', { underline: true });
        doc.fontSize(10).font('Helvetica').text(`${tenant.name}`, { margin: [10, 0, 0, 0] });
        doc.fontSize(9).fillColor('#666').text(`Period: ${dateRange.from} to ${dateRange.to}`);
        doc.moveDown();

        // Executive summary
        this._addExecutiveSummary(doc, analytics);

        // Assessment metrics
        this._addAssessmentMetrics(doc, analytics);

        // Alert statistics
        this._addAlertStatistics(doc, analytics);

        // Department breakdown
        this._addDepartmentBreakdown(doc, analytics);

        // Trends
        this._addTrends(doc, analytics);

        // Recommendations for HR
        this._addHRRecommendations(doc, analytics);

        // Footer
        this._addFooter(doc);

        doc.end();
      } catch (err) {
        logger.error('Failed to generate HR report', { error: err.message });
        reject(new Error('Failed to generate HR report PDF'));
      }
    });
  }

  /**
   * Add header with Cittaa branding
   */
  _addHeader(doc, tenant) {
    doc.fillColor('#0066cc');
    doc.fontSize(16).font('Helvetica-Bold').text('Vocalysis Platform', 40, 40);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Powered by VocaCore™ | ${tenant.name}`, 40, 60);
    doc.moveTo(40, 75).lineTo(555, 75).stroke();
    doc.moveDown(2);
  }

  /**
   * Add patient information section
   */
  _addPatientInfo(doc, patient, session) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Patient Information', { underline: true });
    doc.fontSize(10).font('Helvetica').fillColor('#000');

    // Anonymize if needed
    const patientName = patient.anonymizeReports ? 'Patient ID: ' + patient._id.toString().slice(-8) : patient.firstName + ' ' + patient.lastName;
    const patientDOB = patient.anonymizeReports ? 'XXXX-XX-XX' : patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-IN') : 'N/A';

    doc.text(`Name: ${patientName}`);
    doc.text(`Date of Birth: ${patientDOB}`);
    doc.text(`Assessment Date: ${new Date(session.createdAt).toLocaleDateString('en-IN')}`);
    doc.text(`Assessment Time: ${new Date(session.createdAt).toLocaleTimeString('en-IN')}`);

    doc.moveDown();
  }

  /**
   * Add VocaCore scores with visual gauges
   */
  _addVocaCoreScores(doc, results) {
    if (!results) return;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('VocaCore™ Assessment Scores', { underline: true });
    doc.moveDown();

    const scores = [
      { label: 'Depression Score', value: results.depression_score, thresholds: { high: 70, critical: 85 } },
      { label: 'Anxiety Score', value: results.anxiety_score, thresholds: { high: 65, critical: 80 } },
      { label: 'Stress Score', value: results.stress_score, thresholds: { high: 75, critical: 85 } },
      { label: 'Emotional Stability', value: results.emotional_stability_score, thresholds: { high: 40, critical: 25 } },
      { label: 'Confidence Score', value: results.confidence_score, thresholds: { high: 50, critical: 30 } }
    ];

    scores.forEach(score => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(score.label, { width: 150 });

      // Draw simple gauge representation using ASCII-style visualization
      const gaugeText = this._generateGaugeAscii(score.value);
      doc.fontSize(9).font('Courier').fillColor('#333').text(gaugeText);

      // Score value
      doc.fontSize(11).font('Helvetica-Bold').fillColor(this._getScoreColor(score.value, score.thresholds)).text(`${score.value}/100`, { align: 'right' });
      doc.moveDown(0.5);
    });

    doc.moveDown();
  }

  /**
   * Generate ASCII gauge visualization
   */
  _generateGaugeAscii(value) {
    const maxBars = 20;
    const filledBars = Math.round((value / 100) * maxBars);
    const emptyBars = maxBars - filledBars;
    return '[' + '█'.repeat(filledBars) + '░'.repeat(emptyBars) + ']';
  }

  /**
   * Get color based on score severity
   */
  _getScoreColor(value, thresholds) {
    if (value >= thresholds.critical) return '#d32f2f'; // Red
    if (value >= thresholds.high) return '#f57c00'; // Orange
    return '#388e3c'; // Green
  }

  /**
   * Add biomarker findings section
   */
  _addBiomarkerFindings(doc, results) {
    if (!results || !results.biomarker_findings) return;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Biomarker Findings', { underline: true });
    doc.moveDown();

    const findings = results.biomarker_findings;
    for (const [key, finding] of Object.entries(findings)) {
      doc.fontSize(10).font('Helvetica-Bold').text(this._formatFieldName(key) + ':');
      doc.fontSize(9).font('Helvetica').text(`Finding: ${finding.finding}`);
      doc.fontSize(9).font('Helvetica').fillColor(this._getSeverityColor(finding.severity)).text(`Severity: ${finding.severity.toUpperCase()}`);
      doc.fillColor('#000');
      doc.moveDown(0.5);
    }

    doc.moveDown();
  }

  /**
   * Get color based on severity level
   */
  _getSeverityColor(severity) {
    switch (severity) {
      case 'high':
        return '#d32f2f';
      case 'moderate':
        return '#f57c00';
      case 'low':
        return '#388e3c';
      default:
        return '#000';
    }
  }

  /**
   * Add clinical flags section
   */
  _addClinicalFlags(doc, results) {
    if (!results || !results.clinical_flags || results.clinical_flags.length === 0) return;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#d32f2f').text('Clinical Flags', { underline: true });
    doc.moveDown();

    results.clinical_flags.forEach(flag => {
      doc.fontSize(10).font('Helvetica').text('• ' + flag);
    });

    doc.moveDown();
  }

  /**
   * Add clinician notes section
   */
  _addCliniciannNotes(doc, notes) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Clinician Notes', { underline: true });
    doc.fontSize(10).font('Helvetica').fillColor('#000').text(notes, { align: 'left' });
    doc.moveDown();
  }

  /**
   * Add recommendations section
   */
  _addRecommendations(doc, results) {
    if (!results) return;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Recommendations', { underline: true });
    doc.fontSize(10).font('Helvetica').fillColor('#000');

    const recommendations = this._generateRecommendations(results);
    recommendations.forEach(rec => {
      doc.text('• ' + rec);
    });

    doc.fontSize(9).fillColor('#666').text(`Recommended follow-up: ${results.recommended_followup_weeks} weeks`);
    doc.moveDown();
  }

  /**
   * Generate recommendations based on scores
   */
  _generateRecommendations(results) {
    const recommendations = [];

    if (results.depression_score > 70) {
      recommendations.push('Consider consultation with mental health professional for depression assessment');
    }

    if (results.anxiety_score > 65) {
      recommendations.push('Stress management and relaxation techniques recommended');
    }

    if (results.stress_score > 75) {
      recommendations.push('Workload review and stress reduction strategies advised');
    }

    if (results.emotional_stability_score < 40) {
      recommendations.push('Regular check-ins and emotional support recommended');
    }

    if (results.confidence_score < 50) {
      recommendations.push('Career counseling or skills development program suggested');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue current wellness practices and routine assessments');
    }

    return recommendations;
  }

  /**
   * Add footer with legal disclaimer
   */
  _addFooter(doc) {
    doc.moveTo(40, 750).lineTo(555, 750).stroke();
    doc.fontSize(8).fillColor('#666').text('Powered by VocaCore™ | Cittaa Health Services', 40, 760, { align: 'center' });
    doc.fontSize(7).text('This report is confidential and intended for authorized personnel only.', 40, 775, { align: 'center' });
    doc.text('VocaCore™ is a proprietary voice biomarker analysis system.', 40, 785, { align: 'center' });
  }

  /**
   * Add executive summary for HR reports
   */
  _addExecutiveSummary(doc, analytics) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Executive Summary', { underline: true });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica').fillColor('#000');
    doc.text(`Total Employees Assessed: ${analytics.totalEmployees || 0}`);
    doc.text(`Total Assessments Completed: ${analytics.totalAssessments || 0}`);
    doc.text(`Average Wellness Score: ${(analytics.avgWellnessScore || 0).toFixed(1)}/100`);
    doc.text(`Active Alerts: ${analytics.activeAlerts || 0}`);
    doc.text(`Critical Alerts: ${analytics.criticalAlerts || 0}`);
    doc.moveDown();
  }

  /**
   * Add assessment metrics for HR reports
   */
  _addAssessmentMetrics(doc, analytics) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Assessment Metrics', { underline: true });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica').fillColor('#000');
    doc.text(`Assessments This Period: ${analytics.assessmentsThisPeriod || 0}`);
    doc.text(`Avg Assessment Response Time: ${(analytics.avgResponseTimeMs || 0) / 1000}s`);
    doc.text(`Assessment Completion Rate: ${(analytics.completionRate || 0).toFixed(1)}%`);
    doc.moveDown();
  }

  /**
   * Add alert statistics for HR reports
   */
  _addAlertStatistics(doc, analytics) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Alert Summary', { underline: true });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica').fillColor('#000');
    doc.text(`High Priority Alerts: ${analytics.highPriorityAlerts || 0}`);
    doc.text(`Critical Alerts: ${analytics.criticalAlerts || 0}`);
    doc.text(`Acknowledged Alerts: ${analytics.acknowledgedAlerts || 0}`);
    doc.text(`Escalated Cases: ${analytics.escalatedCases || 0}`);
    doc.moveDown();
  }

  /**
   * Add department breakdown for HR reports
   */
  _addDepartmentBreakdown(doc, analytics) {
    if (!analytics.departmentStats || analytics.departmentStats.length === 0) return;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Department Breakdown', { underline: true });
    doc.moveDown();

    doc.fontSize(9).font('Helvetica');
    analytics.departmentStats.forEach(dept => {
      doc.text(`${dept.name}: ${dept.assessments} assessments, Avg Score: ${(dept.avgScore || 0).toFixed(1)}`);
    });

    doc.moveDown();
  }

  /**
   * Add trends section for HR reports
   */
  _addTrends(doc, analytics) {
    if (!analytics.trends) return;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Wellness Trends', { underline: true });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica').fillColor('#000');
    if (analytics.trends.improvementRate) {
      doc.text(`Improvement Rate: ${(analytics.trends.improvementRate * 100).toFixed(1)}%`);
    }
    if (analytics.trends.riskIncrease) {
      doc.text(`Risk Increase: ${(analytics.trends.riskIncrease * 100).toFixed(1)}%`);
    }
    doc.moveDown();
  }

  /**
   * Add HR recommendations
   */
  _addHRRecommendations(doc, analytics) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0066cc').text('Recommendations for HR', { underline: true });
    doc.fontSize(10).font('Helvetica').fillColor('#000');

    const recommendations = this._generateHRRecommendations(analytics);
    recommendations.forEach(rec => {
      doc.text('• ' + rec);
    });

    doc.moveDown();
  }

  /**
   * Generate HR-specific recommendations
   */
  _generateHRRecommendations(analytics) {
    const recommendations = [];

    if ((analytics.criticalAlerts || 0) > 0) {
      recommendations.push('Review and follow up on critical alerts with appropriate support');
    }

    if ((analytics.assessmentCompletion || 100) < 80) {
      recommendations.push('Increase engagement and participation in wellness assessments');
    }

    if ((analytics.highPriorityAlerts || 0) > (analytics.totalEmployees || 1) * 0.1) {
      recommendations.push('Consider company-wide wellness initiatives and training');
    }

    recommendations.push('Schedule regular 1-on-1 wellness check-ins with identified employees');
    recommendations.push('Provide access to mental health resources and counseling services');

    return recommendations;
  }

  /**
   * Format field name for display
   */
  _formatFieldName(field) {
    return field
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

module.exports = new PDFGenerator();
