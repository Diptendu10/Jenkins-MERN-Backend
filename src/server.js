const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();

// =========================
// CORS Configuration
// =========================

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://3.218.222.116',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin
      // (curl, Postman, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(`CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },

    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

    credentials: true,

    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization'
    ]
  })
);

// =========================
// Other Middleware
// =========================

app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());

// =========================
// MongoDB Configuration
// =========================

const isMongoConfigured = () => {
  return (
    typeof process.env.MONGODB_URI === 'string' &&
    process.env.MONGODB_URI.trim() !== '' &&
    !process.env.MONGODB_URI.includes('<')
  );
};

const ensureDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      error:
        'Database is not configured or unavailable. Add a valid MONGODB_URI to enable user data operations.'
    });

    return false;
  }

  return true;
};

// =========================
// MongoDB Atlas Connection
// =========================

const connectDB = async () => {
  if (!isMongoConfigured()) {
    console.warn(
      'Warning: MONGODB_URI is not configured. Starting the API without a database connection.'
    );
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Success: MongoDB Atlas Connected Successfully');
  } catch (error) {
    console.error('Error: MongoDB Connection Error:', error.message);
  }
};

// =========================
// User Model
// =========================

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  role: {
    type: String,
    default: 'user'
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// =========================
// Health Route
// =========================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
  });
});

// =========================
// GET All Users
// =========================

app.get('/api/users', async (req, res) => {
  if (!ensureDatabase(res)) return;

  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('GET /api/users error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =========================
// CREATE User
// =========================

app.post('/api/users', async (req, res) => {
  if (!ensureDatabase(res)) return;

  try {
    const { name, email, role } = req.body;

    const user = new User({
      name,
      email,
      role
    });

    await user.save();

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('POST /api/users error:', error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// =========================
// GET User By ID
// =========================

app.get('/api/users/:id', async (req, res) => {
  if (!ensureDatabase(res)) return;

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('GET /api/users/:id error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =========================
// UPDATE User
// =========================

app.put('/api/users/:id', async (req, res) => {
  if (!ensureDatabase(res)) return;

  try {
    const { name, email, role } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        role
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('PUT /api/users/:id error:', error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// =========================
// DELETE User
// =========================

app.delete('/api/users/:id', async (req, res) => {
  if (!ensureDatabase(res)) return;

  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('DELETE /api/users/:id error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =========================
// Start Server
// =========================

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Allowed CORS origins:', allowedOrigins);
});