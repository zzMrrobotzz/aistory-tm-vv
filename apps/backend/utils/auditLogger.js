const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry
 * @param {string} action - The action being logged
 * @param {string} description - Description of the action
 * @param {Object} metadata - Additional metadata (optional)
 * @param {string} userId - User ID (optional)
 * @param {string} ipAddress - IP address (optional)
 */
const createAuditLog = async (action, description = '', metadata = {}, userId = null, ipAddress = null) => {
  try {
    // Support both old and new function signatures for backward compatibility
    let details, actor;
    if (typeof description === 'string' && typeof metadata === 'string') {
      // Old signature: createAuditLog(action, details, actor)
      details = description;
      actor = metadata;
      const log = new AuditLog({ action, details, actor });
      await log.save();
    } else {
      // New signature: createAuditLog(action, description, metadata, userId, ipAddress)
      const auditEntry = new AuditLog({
        action,
        details: description,
        actor: 'System',
        metadata,
        userId,
        ipAddress,
        timestamp: new Date()
      });
      await auditEntry.save();
    }
    
    console.log(`📝 Audit log created: ${action} - ${description}`);
  } catch (error) {
    console.error('❌ Failed to create audit log:', error);
    // Don't throw error to prevent breaking the main flow
  }
};

/**
 * Get audit logs with filtering and pagination
 * @param {Object} filters - Filters for the query
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - Paginated audit logs
 */
const getAuditLogs = async (filters = {}, page = 1, limit = 50) => {
  try {
    const query = {};
    
    // Apply filters
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.userId) {
      query.userId = filters.userId;
    }
    if (filters.startDate && filters.endDate) {
      query.timestamp = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }
    if (filters.search) {
      query.$or = [
        { action: { $regex: filters.search, $options: 'i' } },
        { details: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    return {
      logs,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total
      }
    };
  } catch (error) {
    console.error('❌ Failed to get audit logs:', error);
    throw error;
  }
};

/**
 * Get audit log statistics
 * @returns {Object} - Audit log statistics
 */
const getAuditLogStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      totalLogs,
      logsToday,
      topActions,
      recentActivity
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ timestamp: { $gte: today } }),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(5)
        .select('action details timestamp')
    ]);

    return {
      totalLogs,
      logsToday,
      topActions: topActions.map(item => ({
        action: item._id,
        count: item.count
      })),
      recentActivity
    };
  } catch (error) {
    console.error('❌ Failed to get audit log stats:', error);
    throw error;
  }
};

/**
 * Clean up old audit logs (older than specified days)
 * @param {number} days - Number of days to keep
 * @returns {number} - Number of deleted logs
 */
const cleanupOldLogs = async (days = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} audit logs older than ${days} days`);
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Failed to cleanup old audit logs:', error);
    throw error;
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLogStats,
  cleanupOldLogs
}; 