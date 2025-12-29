const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve your frontend files

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/foodswing', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Contact Message Schema
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', contactSchema);

// User Mood Selection Schema (for analytics)
const moodSelectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mood: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const MoodSelection = mongoose.model('MoodSelection', moodSelectionSchema);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============= AUTHENTICATION ROUTES =============

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully! 🎉',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Welcome back! 🎉',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
    });
  }
});

// Verify Token (for session validation)
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ============= MOOD & FOOD ROUTES =============

// Track mood selection (for analytics)
app.post('/api/mood/select', authenticateToken, async (req, res) => {
  try {
    const { mood } = req.body;
    
    const moodSelection = new MoodSelection({
      userId: req.user.id,
      mood
    });

    await moodSelection.save();

    res.json({
      success: true,
      message: 'Mood tracked successfully'
    });
  } catch (error) {
    console.error('Mood tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to track mood' 
    });
  }
});

// Get user's mood history
app.get('/api/mood/history', authenticateToken, async (req, res) => {
  try {
    const moodHistory = await MoodSelection.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({
      success: true,
      history: moodHistory
    });
  } catch (error) {
    console.error('Mood history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch mood history' 
    });
  }
});

// ============= CONTACT FORM ROUTE =============

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all fields' 
      });
    }

    // Save contact message
    const contact = new Contact({
      name,
      email,
      message
    });

    await contact.save();

    res.json({
      success: true,
      message: 'Thank you for your message! We\'ll get back to you soon. 📧'
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message. Please try again.' 
    });
  }
});

// ============= BLOG ROUTES (Optional - for future) =============

// Get all blog posts
app.get('/api/blog/posts', (req, res) => {
  // For now, return static data matching your frontend
  // Later you can move this to a database
  const posts = [
    {
      id: 'comfort-food',
      title: 'The Science Behind Comfort Food',
      excerpt: 'Discover why certain foods make us feel better...',
      date: 'Dec 1, 2024',
      readTime: '5 min read',
      tag: 'Psychology'
    },
    // Add more posts as needed
  ];

  res.json({
    success: true,
    posts
  });
});

// ============= ADMIN ROUTES (Optional) =============

// Get all contact messages (admin only)
app.get('/api/admin/contacts', authenticateToken, async (req, res) => {
  try {
    // Add admin role check here if needed
    const contacts = await Contact.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      contacts
    });
  } catch (error) {
    console.error('Admin contacts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch contacts' 
    });
  }
});

// Get analytics data
app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMoodSelections = await MoodSelection.countDocuments();
    const totalContacts = await Contact.countDocuments();

    // Mood distribution
    const moodStats = await MoodSelection.aggregate([
      {
        $group: {
          _id: '$mood',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      analytics: {
        totalUsers,
        totalMoodSelections,
        totalContacts,
        moodStats
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'FoodSwing API is running! 🍔',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FoodSwing backend running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}/api`);
});