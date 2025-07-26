// Username normalization utilities
const normalizeUsername = (username) => {
    if (!username) return username;
    
    // Convert to lowercase and trim
    let normalized = username.toLowerCase().trim();
    
    // Remove special characters except numbers and letters
    normalized = normalized.replace(/[^a-z0-9]/g, '');
    
    return normalized;
};

const findUserByUsernameVariations = async (User, inputUsername) => {
    const normalized = normalizeUsername(inputUsername);
    
    // Try multiple variations to find the user
    const variations = [
        inputUsername,           // Original input
        normalized,             // Normalized version
        `${normalized}1`,       // With suffix 1
        `${normalized}2`,       // With suffix 2
        inputUsername.toLowerCase(),
        inputUsername.toUpperCase(),
    ];
    
    for (const variation of variations) {
        const user = await User.findOne({ username: variation });
        if (user) {
            return {
                user,
                matchedUsername: variation,
                originalInput: inputUsername
            };
        }
    }
    
    return null;
};

const suggestAvailableUsername = async (User, desiredUsername) => {
    const normalized = normalizeUsername(desiredUsername);
    
    // Check if exact username is available
    let user = await User.findOne({ username: normalized });
    if (!user) {
        return normalized;
    }
    
    // Try with numbers
    for (let i = 1; i <= 99; i++) {
        const suggestion = `${normalized}${i}`;
        user = await User.findOne({ username: suggestion });
        if (!user) {
            return suggestion;
        }
    }
    
    // If all numbers are taken, use timestamp
    return `${normalized}${Date.now().toString().slice(-4)}`;
};

module.exports = {
    normalizeUsername,
    findUserByUsernameVariations,
    suggestAvailableUsername
};
