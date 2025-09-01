/**
 * Timezone utilities for Vietnam time (Asia/Ho_Chi_Minh)
 */

/**
 * Get current Vietnam date in YYYY-MM-DD format
 */
function getVietnamDate() {
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    return vietnamTime.toISOString().split('T')[0];
}

/**
 * Get current Vietnam time in HH:mm format  
 */
function getVietnamTime() {
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    return vietnamTime.toTimeString().slice(0, 5); // HH:mm format
}

/**
 * Get current Vietnam timestamp
 */
function getVietnamTimestamp() {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
}

/**
 * Convert any date to Vietnam timezone date string (YYYY-MM-DD)
 */
function toVietnamDate(date) {
    const targetDate = date ? new Date(date) : new Date();
    const vietnamTime = new Date(targetDate.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    return vietnamTime.toISOString().split('T')[0];
}

/**
 * Check if two dates are the same day in Vietnam timezone
 */
function isSameVietnamDay(date1, date2) {
    return toVietnamDate(date1) === toVietnamDate(date2);
}

/**
 * Get Vietnam date for N days ago
 */
function getVietnamDateDaysAgo(days) {
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    vietnamTime.setDate(vietnamTime.getDate() - days);
    return vietnamTime.toISOString().split('T')[0];
}

/**
 * Get start of day in Vietnam timezone as UTC Date
 */
function getVietnamDayStart(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const vietnamTime = new Date(targetDate.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    
    // Set to start of day
    vietnamTime.setHours(0, 0, 0, 0);
    
    // Convert back to UTC equivalent
    return new Date(vietnamTime.getTime() + (vietnamTime.getTimezoneOffset() * 60000));
}

/**
 * Get end of day in Vietnam timezone as UTC Date
 */
function getVietnamDayEnd(date = null) {
    const targetDate = date ? new Date(date) : new Date();
    const vietnamTime = new Date(targetDate.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    
    // Set to end of day
    vietnamTime.setHours(23, 59, 59, 999);
    
    // Convert back to UTC equivalent
    return new Date(vietnamTime.getTime() + (vietnamTime.getTimezoneOffset() * 60000));
}

module.exports = {
    getVietnamDate,
    getVietnamTime,
    getVietnamTimestamp,
    toVietnamDate,
    isSameVietnamDay,
    getVietnamDateDaysAgo,
    getVietnamDayStart,
    getVietnamDayEnd
};