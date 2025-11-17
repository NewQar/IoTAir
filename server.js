// server.js - Express backend for Air Quality IoT Dashboard

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Papa = require('papaparse');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'air-quality-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// File paths
const USERS_CSV = path.join(__dirname, 'data', 'users.csv');
const FEEDS_CSV = path.join(__dirname, 'data', 'feeds.csv');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fsSync.existsSync(dataDir)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
}

// ==================== HELPER FUNCTIONS ====================

// Read CSV file and parse
async function readCSV(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return new Promise((resolve, reject) => {
            Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    console.log(`📖 Read ${results.data.length} rows from ${path.basename(filePath)}`);
                    resolve(results.data);
                },
                error: (error) => reject(error)
            });
        });
    } catch (error) {
        console.error(`❌ Error reading CSV file ${filePath}:`, error.message);
        return [];
    }
}

// Write CSV file
async function writeCSV(filePath, data, headers) {
    try {
        const csv = Papa.unparse(data, {
            columns: headers,
            header: true
        });
        await fs.writeFile(filePath, csv, 'utf-8');
        console.log(`✅ Wrote ${data.length} rows to ${path.basename(filePath)}`);
        return true;
    } catch (error) {
        console.error(`❌ Error writing CSV file ${filePath}:`, error.message);
        return false;
    }
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        console.log('⚠️  Unauthorized access attempt');
        res.status(401).json({ error: 'Not authenticated' });
    }
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        console.log('⚠️  Non-admin access attempt to admin route');
        res.status(403).json({ error: 'Admin privileges required' });
    }
}

// ==================== AUTHENTICATION ROUTES ====================

// Register new user
app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.email);
        const { name, email, password } = req.body;
        
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Read existing users
        const users = await readCSV(USERS_CSV);
        
        // Check if email already exists
        if (users.some(u => u.email === email)) {
            console.log('⚠️  Email already exists:', email);
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Add new user
        users.push({
            name,
            email,
            password: hashedPassword,
            role: 'user'
        });
        
        // Write back to CSV
        const success = await writeCSV(USERS_CSV, users, ['name', 'email', 'password', 'role']);
        
        if (success) {
            console.log('✅ User registered successfully:', email);
            res.json({ message: 'Registration successful' });
        } else {
            res.status(500).json({ error: 'Failed to save user' });
        }
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt:', req.body.email);
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Read users
        const users = await readCSV(USERS_CSV);
        
        // Find user
        const user = users.find(u => u.email === email);
        
        if (!user) {
            console.log('⚠️  User not found:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            console.log('⚠️  Invalid password for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Set session
        req.session.user = {
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        console.log('✅ Login successful:', email);
        res.json({ 
            message: 'Login successful',
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Logout
app.get('/api/logout', (req, res) => {
    console.log('👋 Logout:', req.session.user?.email);
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Check authentication status
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== SENSOR DATA ROUTES ====================

// Get sensor data
app.get('/api/sensors', isAuthenticated, async (req, res) => {
    try {
        console.log('📊 Fetching sensor data');
        const feeds = await readCSV(FEEDS_CSV);
        
        if (feeds.length === 0) {
            console.log('⚠️  No sensor data found');
            return res.json({
                latest: {},
                history: [],
                recent: []
            });
        }
        
        // Convert string values to numbers
        const processedFeeds = feeds.map(f => ({
            timestamp: f.created_at,
            entry_id: f.entry_id,
            field1: parseFloat(f.field1) || 0,
            field2: parseFloat(f.field2) || 0,
            field3: parseFloat(f.field3) || 0
        }));
        
        // Get latest reading
        const latest = processedFeeds[processedFeeds.length - 1];
        
        // Get last 20 readings for history (charts)
        const history = processedFeeds.slice(-20);
        
        // Get last 10 readings for table
        const recent = processedFeeds.slice(-10).reverse();
        
        res.json({
            latest: {
                field1: latest.field1,
                field2: latest.field2,
                field3: latest.field3,
                timestamp: latest.timestamp
            },
            history,
            recent
        });
    } catch (error) {
        console.error('❌ Error fetching sensor data:', error);
        res.status(500).json({ error: 'Failed to fetch sensor data' });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        console.log('👥 Fetching all users');
        const users = await readCSV(USERS_CSV);
        
        // Remove passwords from response
        const safeUsers = users.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role
        }));
        
        res.json({ users: safeUsers });
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Add new user (admin only)
app.post('/api/users/add', isAuthenticated, isAdmin, async (req, res) => {
    try {
        console.log('➕ Adding new user:', req.body.email);
        const { name, email, password, role } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Read existing users
        const users = await readCSV(USERS_CSV);
        
        // Check if email already exists
        if (users.some(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Add new user
        users.push({
            name,
            email,
            password: hashedPassword,
            role: role || 'user'
        });
        
        // Write back to CSV
        const success = await writeCSV(USERS_CSV, users, ['name', 'email', 'password', 'role']);
        
        if (success) {
            console.log('✅ User added successfully');
            res.json({ message: 'User added successfully' });
        } else {
            res.status(500).json({ error: 'Failed to add user' });
        }
    } catch (error) {
        console.error('❌ Error adding user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user role (admin only)
app.put('/api/users/:email', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { email } = req.params;
        const { role } = req.body;
        
        console.log(`🔄 Updating role for ${email} to ${role}`);
        
        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        // Read users
        const users = await readCSV(USERS_CSV);
        
        // Find and update user
        const userIndex = users.findIndex(u => u.email === email);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        users[userIndex].role = role;
        
        // Write back to CSV
        const success = await writeCSV(USERS_CSV, users, ['name', 'email', 'password', 'role']);
        
        if (success) {
            console.log('✅ User role updated');
            res.json({ message: 'User role updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update user' });
        }
    } catch (error) {
        console.error('❌ Error updating user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user (admin only)
app.delete('/api/users/:email', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`🗑️  Deleting user: ${email}`);
        
        // Prevent admin from deleting themselves
        if (req.session.user.email === email) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        // Read users
        const users = await readCSV(USERS_CSV);
        
        // Filter out the user to delete
        const filteredUsers = users.filter(u => u.email !== email);
        
        if (filteredUsers.length === users.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Write back to CSV
        const success = await writeCSV(USERS_CSV, filteredUsers, ['name', 'email', 'password', 'role']);
        
        if (success) {
            console.log('✅ User deleted');
            res.json({ message: 'User deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to delete user' });
        }
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    console.log('⚠️  404 Not Found:', req.path);
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER START ====================

app.listen(PORT, async () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 AIR QUALITY DASHBOARD SERVER');
    console.log('='.repeat(50));
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`📁 Users CSV: ${USERS_CSV}`);
    console.log(`📊 Feeds CSV: ${FEEDS_CSV}`);
    console.log('='.repeat(50) + '\n');
    
    // Create default admin if users.csv doesn't exist or is empty
    try {
        if (!fsSync.existsSync(USERS_CSV)) {
            console.log('📝 Creating users.csv...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await writeCSV(USERS_CSV, [{
                name: 'Admin User',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin'
            }], ['name', 'email', 'password', 'role']);
            console.log('✅ Created default admin: admin@example.com / admin123');
        } else {
            const users = await readCSV(USERS_CSV);
            if (users.length === 0) {
                console.log('📝 users.csv is empty, creating default admin...');
                const hashedPassword = await bcrypt.hash('admin123', 10);
                await writeCSV(USERS_CSV, [{
                    name: 'Admin User',
                    email: 'admin@example.com',
                    password: hashedPassword,
                    role: 'admin'
                }], ['name', 'email', 'password', 'role']);
                console.log('✅ Created default admin: admin@example.com / admin123');
            }
        }
        
        // Create feeds.csv if it doesn't exist
        if (!fsSync.existsSync(FEEDS_CSV)) {
            console.log('📝 Creating feeds.csv...');
            const header = 'created_at,entry_id,field1,field2,field3\n';
            fsSync.writeFileSync(FEEDS_CSV, header);
            console.log('✅ Created empty feeds.csv');
        }
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
    
    console.log('✅ Server ready! Open http://localhost:3000 in your browser\n');
});