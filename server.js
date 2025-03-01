// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/assessment-tool', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  createdAt: { type: Date, default: Date.now }
});

const assessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  questions: [{
    type: { type: String, enum: ['mcq', 'descriptive', 'practical', 'viva'], required: true },
    question: { type: String, required: true },
    options: [String], // For MCQs
    correctAnswer: String, // For MCQs
    points: { type: Number, default: 1 }
  }],
  timeLimit: { type: Number }, // in minutes
  createdAt: { type: Date, default: Date.now }
});

const submissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: { type: String },
    isCorrect: { type: Boolean }, // For auto-graded questions
    score: { type: Number }
  }],
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  totalScore: { type: Number },
  feedback: { type: String }
});

const User = mongoose.model('User', userSchema);
const Assessment = mongoose.model('Assessment', assessmentSchema);
const Submission = mongoose.model('Submission', submissionSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  
  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Routes
// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role
    });
    
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );
    
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create assessment (teachers only)
app.post('/api/assessments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can create assessments' });
    }
    
    const assessment = new Assessment({
      ...req.body,
      creator: req.user.id
    });
    
    await assessment.save();
    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all assessments
app.get('/api/assessments', authenticateToken, async (req, res) => {
  try {
    const assessments = await Assessment.find()
      .populate('creator', 'username');
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific assessment
app.get('/api/assessments/:id', authenticateToken, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .populate('creator', 'username');
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit assessment answers
app.post('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const { assessmentId, answers, endTime } = req.body;
    
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    
    // Calculate scores for MCQs automatically
    let totalScore = 0;
    const processedAnswers = answers.map(answer => {
      const question = assessment.questions.id(answer.questionId);
      let isCorrect = false;
      let score = 0;
      
      if (question.type === 'mcq') {
        isCorrect = answer.answer === question.correctAnswer;
        score = isCorrect ? question.points : 0;
        totalScore += score;
      }
      
      return {
        ...answer,
        isCorrect,
        score
      };
    });
    
    const submission = new Submission({
      user: req.user.id,
      assessment: assessmentId,
      answers: processedAnswers,
      endTime,
      totalScore
    });
    
    await submission.save();
    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's submissions
app.get('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const submissions = await Submission.find({ user: req.user.id })
      .populate('assessment', 'title')
      .sort({ endTime: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific submission with results
app.get('/api/submissions/:id', authenticateToken, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('assessment')
      .populate('user', 'username email');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Check if the user is authorized to view this submission
    if (submission.user._id.toString() !== req.user.id && req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Not authorized to view this submission' });
    }
    
    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Grade descriptive, practical and viva answers (teachers only)
app.patch('/api/submissions/:id/grade', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can grade submissions' });
    }
    
    const { answers, feedback } = req.body;
    const submission = await Submission.findById(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Update scores for manually graded questions
    let totalScore = 0;
    for (const answer of answers) {
      const submissionAnswer = submission.answers.id(answer.answerId);
      if (submissionAnswer) {
        submissionAnswer.score = answer.score;
        submissionAnswer.feedback = answer.feedback;
      }
      totalScore += answer.score || 0;
    }
    
    submission.totalScore = totalScore;
    submission.feedback = feedback;
    
    await submission.save();
    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get analytics for a user
app.get('/api/analytics/user', authenticateToken, async (req, res) => {
  try {
    const submissions = await Submission.find({ user: req.user.id })
      .populate('assessment', 'title questions');
    
    if (submissions.length === 0) {
      return res.json({
        assessmentsTaken: 0,
        averageScore: 0,
        topicPerformance: {},
        recentSubmissions: []
      });
    }
    
    // Calculate analytics
    const totalAssessments = submissions.length;
    const totalScorePossible = submissions.reduce((total, sub) => {
      return total + sub.assessment.questions.reduce((sum, q) => sum + q.points, 0);
    }, 0);
    
    const totalScoreObtained = submissions.reduce((total, sub) => total + (sub.totalScore || 0), 0);
    const averageScore = totalScorePossible > 0 ? (totalScoreObtained / totalScorePossible) * 100 : 0;
    
    // Get recent submissions
    const recentSubmissions = submissions
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, 5)
      .map(sub => ({
        id: sub._id,
        title: sub.assessment.title,
        date: sub.endTime,
        score: sub.totalScore,
        maxScore: sub.assessment.questions.reduce((sum, q) => sum + q.points, 0)
      }));
    
    res.json({
      assessmentsTaken: totalAssessments,
      averageScore,
      recentSubmissions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});