const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './src/config/.env' }); // Adjust path if needed

const secret = process.env.JWT_SECRET || 'your_jwt_secret'; // Fallback if env not loaded
const userId = '690ae37bb61220f1d06d062e'; // Use a dummy ID or the one from before

const token = jwt.sign({ userId }, secret, { expiresIn: '1h' });
// Token generated - use process.stdout.write(token) if you need to output it
