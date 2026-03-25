const logger = require('../logger');

module.exports = async function weeklyHRReportProcessor() {
  try {
    logger.info('Starting weekly HR report cron job (timezone: Asia/Kolkata, runs Monday 9AM)');

    const Employee = require('../models/Employee');
    const Tenant = require('../models/Tenant');
    const { queues } = require('../worker');

    // Get date range for this month and last week
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find all active HR_ADMIN users
    const hrAdmins = await Employee.find({
      role: 'HR_ADMIN',
      status: 'active'
    }).populate('tenantId');

    logger.info('Found %d HR admins to send reports to', hrAdmins.length);

    let reportsQueued = 0;
    let reportsFailed = 0;

    for (const hrAdmin of hrAdmins) {
      try {
        const tenantId = hrAdmin.tenantId._id;

        // Get all departments for this HR admin (or all if admin has permission)
        const departments = hrAdmin.managedDepartments || [];

        // Build aggregation query
        let employeeQuery = {
          tenantId,
          status: 'active'
        };

        if (departments.length > 0) {
          employeeQuery.departmentId = { $in: departments };
        }

        // Get all employees
        const allEmployees = await Employee.find(employeeQuery);
        const totalEmployees = allEmployees.length;

        // Get employees assessed this month
        const assessedThisMonth = allEmployees.filter(emp => {
          return emp.wellnessProfile && emp.wellnessProfile.lastAssessmentDate &&
            new Date(emp.wellnessProfile.lastAssessmentDate) >= firstDayOfMonth;
        });

        // Get employees assessed this week
        const assessedThisWeek = allEmployees.filter(emp => {
          return emp.wellnessProfile && emp.wellnessProfile.lastAssessmentDate &&
            new Date(emp.wellnessProfile.lastAssessmentDate) >= sevenDaysAgo;
        });

        // Get employees assessed last week
        const assessedLastWeek = allEmployees.filter(emp => {
          return emp.wellnessProfile && emp.wellnessProfile.lastAssessmentDate &&
            new Date(emp.wellnessProfile.lastAssessmentDate) >= fourteenDaysAgo &&
            new Date(emp.wellnessProfile.lastAssessmentDate) < sevenDaysAgo;
        });

        // Calculate wellness distribution
        const riskDistribution = {
          normal: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        };

        allEmployees.forEach(emp => {
          const riskLevel = emp.wellnessProfile ? emp.wellnessProfile.currentRiskLevel : 'unknown';
          if (riskDistribution.hasOwnProperty(riskLevel)) {
            riskDistribution[riskLevel]++;
          }
        });

        // Calculate trend
        const thisWeekPercentage = totalEmployees > 0 ? (assessedThisWeek.length / totalEmployees) * 100 : 0;
        const lastWeekPercentage = totalEmployees > 0 ? (assessedLastWeek.length / totalEmployees) * 100 : 0;
        const trend = thisWeekPercentage > lastWeekPercentage ? 'Improving' :
                      thisWeekPercentage < lastWeekPercentage ? 'Declining' : 'Stable';

        // Queue report email
        await queues.emailNotifications.add(
          {
            type: 'weekly_hr_report',
            to: hrAdmin.email,
            templateData: {
              hrAdminName: hrAdmin.fullName,
              totalEmployees,
              assessedThisMonth: assessedThisMonth.length,
              assessedThisWeek: assessedThisWeek.length,
              normalCount: riskDistribution.normal,
              lowRiskCount: riskDistribution.low,
              mediumRiskCount: riskDistribution.medium,
              highRiskCount: riskDistribution.high,
              criticalCount: riskDistribution.critical,
              trend,
              weekStartDate: sevenDaysAgo.toLocaleDateString('en-IN'),
              reportGeneratedDate: now.toLocaleDateString('en-IN'),
              dashboardLink: `${process.env.WEB_APP_URL || 'https://app.vocalysis.cittaa.in'}/dashboard/hr`
            }
          },
          { jobId: `hr-report-${tenantId}-${hrAdmin._id}-${Date.now()}` }
        );

        reportsQueued++;
        logger.info(
          'Weekly HR report queued for %s (dept: %d employees, assessed: %d this week)',
          hrAdmin.fullName,
          totalEmployees,
          assessedThisWeek.length
        );
      } catch (error) {
        reportsFailed++;
        logger.warn('Failed to generate report for HR admin %s: %s', hrAdmin.fullName, error.message);
      }
    }

    logger.info('Weekly HR reports completed: %d queued, %d failures', reportsQueued, reportsFailed);

    return {
      status: 'completed',
      hrAdminsProcessed: hrAdmins.length,
      reportsQueued,
      reportsFailed,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Weekly HR report cron failed: %s', error.message);
    throw error;
  }
};
