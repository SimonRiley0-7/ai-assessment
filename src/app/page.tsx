// app/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mic, Speaker, FileUp, Send, Play, Square, X, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function AssessmentTool() {
  const [activeView, setActiveView] = useState("assessment"); // "assessment", "results", "login"
  const [currentTab, setCurrentTab] = useState("mcq");
  const [isListening, setIsListening] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [mcqAnswer, setMcqAnswer] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timer, setTimer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [user, setUser] = useState(null);
  // New state for AI evaluation
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiEvaluations, setAiEvaluations] = useState([]);
  
  const speechRecognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Initialize Web Speech API on component mount
  useEffect(() => {
    // Initialize speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    
    // Initialize speech recognition if available
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      speechRecognitionRef.current = new SpeechRecognition();
      speechRecognitionRef.current.continuous = true;
      speechRecognitionRef.current.interimResults = true;
      
      speechRecognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setUserAnswer(transcript);
      };
      
      speechRecognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        
        let errorMessage = `Error: ${event.error}. Please try again.`;
        if (event.error === 'network') {
          errorMessage = "Network error detected. Please check your internet connection and try again.";
        }
        
        toast({
          title: "Speech Recognition Error",
          description: errorMessage,
          variant: "destructive"
        });
      };
    }
    
    // Fetch sample assessment
    fetchSampleAssessment();
    
    return () => {
      // Cleanup speech synthesis and recognition
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);
  
  // Sample assessment data (in a real app, this would come from the API)
  const fetchSampleAssessment = () => {
    const sampleAssessment = {
      _id: "12345",
      title: "Introduction to AI",
      description: "Test your knowledge on artificial intelligence basics",
      timeLimit: 30, // 30 minutes
      questions: [
        {
          _id: "q1",
          type: "mcq",
          question: "Which of the following is a characteristic of machine learning algorithms?",
          options: [
            "They can only be supervised", 
            "They improve with experience", 
            "They always require labeled data", 
            "They can only work with numerical data"
          ],
          correctAnswer: "They improve with experience",
          points: 1,
          // Added rubric/criteria for AI evaluation
          evaluationCriteria: "The correct answer is 'They improve with experience'. This is a fundamental characteristic of ML algorithms - they get better as they process more data."
        },
        {
          _id: "q2",
          type: "descriptive",
          question: "Explain the ethical considerations in developing AI systems for healthcare.",
          points: 3,
          // Added rubric/criteria for AI evaluation
          evaluationCriteria: "A complete answer should address: 1) Patient privacy and data security, 2) Algorithmic bias and fairness, 3) Transparency and explainability, 4) Accountability and liability, 5) Informed consent. Award 3 points for comprehensive coverage of all areas with examples, 2 points for good coverage of most areas, 1 point for basic understanding with limited discussion."
        },
        {
          _id: "q3",
          type: "practical",
          question: "Create a function to calculate the Fibonacci sequence up to n terms.",
          points: 5,
          // Added rubric/criteria for AI evaluation
          evaluationCriteria: "Evaluate the code on: 1) Correctness - does it generate the correct Fibonacci sequence? 2) Efficiency - is the algorithm optimized? 3) Edge cases - does it handle n=0, n=1, etc.? 4) Code style and readability. 5) Documentation/comments. Award points accordingly, with full points for a solution that is both correct and efficient."
        }
      ]
    };
    
    setAssessment(sampleAssessment);
    setTimeRemaining(sampleAssessment.timeLimit * 60); // Convert minutes to seconds
    
    // Initialize answers array
    const initialAnswers = sampleAssessment.questions.map(q => ({
      questionId: q._id,
      answer: ""
    }));
    setAnswers(initialAnswers);
    
    // Initialize AI evaluations array
    setAiEvaluations(sampleAssessment.questions.map(q => ({
      questionId: q._id,
      score: null,
      feedback: "",
      isEvaluated: false
    })));
    
    // Set initial tab based on first question type
    setCurrentTab(sampleAssessment.questions[0].type);
    
    // Start timer
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setTimer(interval);
  };
  
  // Speech recognition functions
  const toggleSpeechRecognition = () => {
    if (!speechRecognitionRef.current) {
      toast({
        title: "Speech Recognition Not Available",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }
    
    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Check for internet connectivity
      if (!navigator.onLine) {
        toast({
          title: "Network Error",
          description: "Speech recognition requires an internet connection. Please check your connection and try again.",
          variant: "destructive"
        });
        return;
      }
      
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Speech recognition start error:", error);
        toast({
          title: "Speech Recognition Error",
          description: "Could not start speech recognition. Please try using text input instead.",
          variant: "destructive"
        });
      }
    }
  };
  
  // Text-to-speech function
  const readQuestion = () => {
    if (!synthRef.current) {
      toast({
        title: "Text-to-Speech Not Available",
        description: "Your browser doesn't support text-to-speech.",
        variant: "destructive"
      });
      return;
    }
    
    // Cancel any ongoing speech
    if (isReading) {
      synthRef.current.cancel();
      setIsReading(false);
      return;
    }
    
    const currentQ = assessment.questions[currentQuestion];
    var text = currentQ.question;
    
    // Add options for MCQ
    if (currentQ.type === "mcq") {
      currentQ.options.forEach((option, index) => {
        text += `. Option ${index + 1}: ${option}.`;
      });
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsReading(true);
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => {
      setIsReading(false);
      toast({
        title: "Text-to-Speech Error",
        description: "There was an error playing the audio.",
        variant: "destructive"
      });
    };
    
    synthRef.current.speak(utterance);
  };
  
  // Audio recording for viva questions
  const startRecording = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          audioRecorderRef.current = new MediaRecorder(stream);
          audioRecorderRef.current.ondataavailable = (e) => {
            audioChunksRef.current.push(e.data);
          };
          
          audioRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // In a real app, you would upload this blob to the server
            // For the demo, we'll simulate a transcript
            setTimeout(() => {
              setUserAnswer("This is a simulated transcript of the audio recording where I discussed the impact of AI on job markets, including automation of routine tasks, creation of new job categories, and the need for workforce reskilling.");
            }, 1000);
            
            // Reset audio chunks for next recording
            audioChunksRef.current = [];
          };
          
          audioRecorderRef.current.start();
          setIsListening(true);
        })
        .catch(error => {
          console.error("Error accessing microphone:", error);
          toast({
            title: "Microphone Access Error",
            description: "Could not access your microphone. Please check permissions.",
            variant: "destructive"
          });
        });
    } else {
      toast({
        title: "Recording Not Available",
        description: "Your browser doesn't support audio recording.",
        variant: "destructive"
      });
    }
  };
  
  const stopRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
      audioRecorderRef.current.stop();
      setIsListening(false);
    }
  };
  
  // Handle answer updates
  const updateAnswer = (value) => {
    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestion].answer = value;
    setAnswers(updatedAnswers);
    
    if (assessment?.questions[currentQuestion].type === "mcq") {
      setMcqAnswer(value);
    } else {
      setUserAnswer(value);
    }
  };
  
  // Navigate to next/previous question
  const goToQuestion = (index) => {
    if (!assessment || index < 0 || index >= assessment.questions.length) return;
    
    // Save current answer before navigating
    const updatedAnswers = [...answers];
    if (assessment.questions[currentQuestion].type === "mcq") {
      updatedAnswers[currentQuestion].answer = mcqAnswer;
    } else {
      updatedAnswers[currentQuestion].answer = userAnswer;
    }
    setAnswers(updatedAnswers);
    
    // Navigate to new question
    setCurrentQuestion(index);
    
    // Important fix: Set the current tab to match the question type
    const newQuestionType = assessment.questions[index].type;
    setCurrentTab(newQuestionType);
    
    // Update input fields for new question
    if (newQuestionType === "mcq") {
      setMcqAnswer(updatedAnswers[index].answer || "");
      setUserAnswer("");
    } else {
      setUserAnswer(updatedAnswers[index].answer || "");
      setMcqAnswer("");
    }
  };
  
  // Format time remaining
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };
  
  // NEW: Function to evaluate an answer using the Gemini API
  // NEW: Function to evaluate an answer using the Gemini API
// Fixed function to evaluate an answer using the Gemini API
const evaluateWithGemini = async (question, answer, criteria, questionType) => {
  try {
    // Create the prompt for Gemini
    const prompt = `
      You are an AI education assessment tool. Evaluate the following student response.
      
      QUESTION: ${question}
      
      STUDENT ANSWER: ${answer}
      
      EVALUATION CRITERIA: ${criteria}
      
      Please provide:
      1. A score (as a number) based on the criteria. For MCQ questions, score 1 if correct, 0 if incorrect.
      For descriptive questions, score on a scale mentioned in the criteria.
      For practical coding questions, evaluate correctness, efficiency, and handling of edge cases.
      2. Detailed feedback explaining the score, highlighting strengths and areas for improvement.
      3. If applicable, provide a model answer or approach.
      
      Format your response as a JSON object with the following fields:
      {
        "score": [number],
        "maxScore": [number from criteria],
        "feedback": [detailed explanation],
        "modelAnswer": [optional correct or improved answer]
      }
    `;

    // Get the API key from environment variables
    const apiKey = 'AIzaSyCHbQGULAdNukfJSgE11Vm4iHCY9qFkBiA';
    
    if (!apiKey) {
      console.error("Gemini API key not found");
      throw new Error("API key not configured");
    }

    // Make the API call to Gemini
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the response text from Gemini
    const responseText = data.candidates[0].content.parts[0].text;
    
    // Improved JSON extraction with better error handling
    // Look for text that appears to be JSON (between curly braces)
    let jsonStr = '';
    try {
      // First try to find JSON-like content with a regex
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        // Fallback to the previous approach
        let jsonStart = responseText.indexOf('{');
        let jsonEnd = responseText.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          jsonStr = responseText.substring(jsonStart, jsonEnd);
        }
      }
      
      // Try to parse the JSON
      const evaluationResult = jsonStr ? JSON.parse(jsonStr) : null;
      
      // If parsing succeeded, return the evaluation result
      if (evaluationResult) {
        return {
          score: evaluationResult.score || 0,
          maxScore: evaluationResult.maxScore || (questionType === "mcq" ? 1 : (questionType === "descriptive" ? 3 : 5)),
          feedback: evaluationResult.feedback || "Unable to generate feedback",
          modelAnswer: evaluationResult.modelAnswer || null
        };
      }
    } catch (jsonError) {
      console.error("Error parsing JSON from Gemini response:", jsonError);
      console.log("Attempted to parse:", jsonStr);
    }
    
    // If JSON parsing failed, extract information manually
    // This serves as a fallback to parse the information even if it's not in proper JSON format
    console.log("Falling back to manual extraction from response:", responseText);
    
    // Attempt to extract score
    const scoreMatch = responseText.match(/score["\s:]+(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    
    // Determine max score
    const maxScore = questionType === "mcq" ? 1 : (questionType === "descriptive" ? 3 : 5);
    
    // Extract feedback - look for feedback sections
    let feedback = "Unable to parse feedback from the response.";
    const feedbackMatch = responseText.match(/feedback["\s:]+([^"]*?)(?=\s*[,"}]|$)/i) || 
                         responseText.match(/feedback[\s:]([\s\S]*?)(?=\s*model answer|\s*$)/i);
    if (feedbackMatch && feedbackMatch[1]) {
      feedback = feedbackMatch[1].trim();
    }
    
    // Extract model answer if available
    let modelAnswer = null;
    const modelMatch = responseText.match(/modelAnswer["\s:]+([^"]*?)(?=\s*[,"}]|$)/i) ||
                      responseText.match(/model answer[\s:]([\s\S]*?)(?=\s*$)/i);
    if (modelMatch && modelMatch[1]) {
      modelAnswer = modelMatch[1].trim();
    }
    
    return {
      score,
      maxScore,
      feedback,
      modelAnswer
    };
    
  } catch (error) {
    console.error("Error evaluating with Gemini:", error);
    toast({
      title: "Evaluation Error",
      description: "There was an error evaluating your answer. Please try again.",
      variant: "destructive"
    });
    
    // Return a fallback result
    return {
      score: 0,
      maxScore: questionType === "mcq" ? 1 : (questionType === "descriptive" ? 3 : 5),
      feedback: "Error in evaluation. Please contact support if this persists.",
      modelAnswer: null
    };
  }
};
  
  // Handle assessment submission
  const handleSubmitAssessment = async () => {
    setIsSubmitting(true);
    
    try {
      // Save current answer before submitting
      const updatedAnswers = [...answers];
      if (assessment.questions[currentQuestion].type === "mcq") {
        updatedAnswers[currentQuestion].answer = mcqAnswer;
      } else {
        updatedAnswers[currentQuestion].answer = userAnswer;
      }
      setAnswers(updatedAnswers);
      
      // Evaluate all answers with Gemini
      setIsEvaluating(true);
      toast({
        title: "Evaluating Answers",
        description: "Using AI to evaluate your responses. This may take a moment...",
      });
      
      // Process each question's answer
      const evaluations = [...aiEvaluations];
      let totalScore = 0;
      let maxScore = 0;
      
      // Process each question sequentially to avoid overwhelming the API
      for (let i = 0; i < assessment.questions.length; i++) {
        const question = assessment.questions[i];
        const answer = updatedAnswers[i].answer;
        
        // Call Gemini API for evaluation
        const evaluation = await evaluateWithGemini(
          question.question,
          answer,
          question.evaluationCriteria,
          question.type
        );
        
        // Update evaluations
        evaluations[i] = {
          questionId: question._id,
          score: evaluation.score,
          maxScore: evaluation.maxScore,
          feedback: evaluation.feedback,
          modelAnswer: evaluation.modelAnswer,
          isEvaluated: true
        };
        
        totalScore += evaluation.score;
        maxScore += evaluation.maxScore;
      }
      
      setAiEvaluations(evaluations);
      
      // Generate and format results
      const percentage = (totalScore / maxScore) * 100;
      
      // Map evaluations to question results format
      const questionResults = assessment.questions.map((q, index) => {
        const answer = updatedAnswers[index].answer;
        const evalu = evaluations[index];
        
        return {
          id: q._id,
          question: q.question,
          answer: answer,
          correctAnswer: evalu.modelAnswer,
          score: evalu.score,
          maxScore: evalu.maxScore,
          feedback: evalu.feedback,
          isCorrect: q.type === "mcq" ? evalu.score === evalu.maxScore : undefined
        };
      });
      
      // Generate mock performance by type data
      const performanceByType = [
        { name: "MCQ", score: evaluations.filter(e => assessment.questions.find(q => q._id === e.questionId).type === "mcq").reduce((sum, e) => sum + e.score, 0), 
          total: evaluations.filter(e => assessment.questions.find(q => q._id === e.questionId).type === "mcq").reduce((sum, e) => sum + e.maxScore, 0) },
        { name: "Descriptive", score: evaluations.filter(e => assessment.questions.find(q => q._id === e.questionId).type === "descriptive").reduce((sum, e) => sum + e.score, 0),
          total: evaluations.filter(e => assessment.questions.find(q => q._id === e.questionId).type === "descriptive").reduce((sum, e) => sum + e.maxScore, 0) },
        { name: "Practical", score: evaluations.filter(e => assessment.questions.find(q => q._id === e.questionId).type === "practical").reduce((sum, e) => sum + e.score, 0),
          total: evaluations.filter(e => assessment.questions.find(q => q._id === e.questionId).type === "practical").reduce((sum, e) => sum + e.maxScore, 0) }
      ].filter(item => item.total > 0); // Only include types that have questions
      
      // Generate AI feedback based on overall performance
      let overallFeedback = "";
      if (percentage >= 85) {
        overallFeedback = "Excellent work! You've demonstrated a strong understanding of AI concepts across all question types. Your practical implementation skills are particularly impressive.";
      } else if (percentage >= 70) {
        overallFeedback = "Good work! You have a solid grasp of AI fundamentals. Focus on strengthening your understanding of theoretical concepts and practical implementations.";
      } else if (percentage >= 50) {
        overallFeedback = "You've shown a basic understanding of AI concepts. Consider reviewing the core principles and practicing with more hands-on examples to improve your practical skills.";
      } else {
        overallFeedback = "You may need to revisit the foundational concepts of AI. Focus on understanding the basic principles before moving to more advanced topics. Consider using additional learning resources.";
      }
      
      const mockResults = {
        totalScore: totalScore,
        maxScore: maxScore,
        feedback: overallFeedback,
        questionResults: questionResults,
        performanceByType: performanceByType,
        overallStats: {
          percentage: percentage.toFixed(2),
          assessmentsTaken: 5,
          averageScore: 72.4,
          recentSubmissions: [
            { title: "Introduction to AI", score: percentage.toFixed(2), date: new Date() },
            { title: "Data Structures", score: 82, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
            { title: "Python Basics", score: 94, date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          ]
        }
      };
      
      setResults(mockResults);
      setActiveView("results");
      
    } catch (error) {
      console.error("Error in submission process:", error);
      toast({
        title: "Submission Error",
        description: "There was an error submitting your assessment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setIsEvaluating(false);
      
      if (timer) {
        clearInterval(timer);
      }
    }
  };
  
const ResultsView = () => (
  <div className="container mx-auto py-6 max-w-4xl">
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-2xl">Assessment Results</CardTitle>
        <CardDescription>
          {assessment?.title} - Completed on {new Date().toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-medium">Overall Score</h3>
              <p className="text-3xl font-bold text-primary mt-2">
                {results.totalScore}/{results.maxScore} ({results.overallStats.percentage}%)
              </p>
            </div>
            <div className="w-32 h-32 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-2xl font-bold">{Math.round(results.overallStats.percentage)}%</p>
              </div>
              <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                <circle 
                  cx="60" 
                  cy="60" 
                  r="54" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 54 * results.overallStats.percentage / 100} ${2 * Math.PI * 54 * (1 - results.overallStats.percentage / 100)}`}
                  className="text-primary" 
                />
              </svg>
            </div>
          </div>
          
          {results.feedback && (
            <Alert>
              <AlertTitle>AI-Generated Feedback</AlertTitle>
              <AlertDescription>{results.feedback}</AlertDescription>
            </Alert>
          )}
          
          <div>
            <h3 className="text-lg font-medium mb-4">Performance by Question Type</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={results.performanceByType}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar name="Score" dataKey="score" fill="#3b82f6" />
                  <Bar name="Total Possible" dataKey="total" fill="#93c5fd" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    
    {/* New section to display all questions with answers */}
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle>Question Analysis</CardTitle>
        <CardDescription>Review all questions with your answers and feedback</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {results.questionResults.map((result, index) => (
            <div 
              key={result.id} 
              className="p-4 border rounded-lg"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-medium">Question {index + 1}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {result.score}/{result.maxScore} points
                  </span>
                  {result.isCorrect !== undefined && (
                    result.isCorrect ? 
                      <CheckCircle className="text-green-500" size={20} /> : 
                      <XCircle className="text-red-500" size={20} />
                  )}
                </div>
              </div>
              
              <div className="mb-3">
                <p className="font-medium">{result.question}</p>
              </div>
              
              <div className="mb-3 p-3 bg-slate-50 rounded-md">
                <p className="text-sm text-slate-500 mb-1">Your Answer:</p>
                <div className="whitespace-pre-wrap">{result.answer || "(No answer provided)"}</div>
              </div>
              
              {result.correctAnswer && (
                <div className="mb-3 p-3 bg-green-50 rounded-md">
                  <p className="text-sm text-green-700 mb-1">Correct Answer:</p>
                  <div className="whitespace-pre-wrap">{result.correctAnswer}</div>
                </div>
              )}
              
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700 mb-1">AI Feedback:</p>
                <p>{result.feedback}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Your Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Assessments Taken</p>
              <p className="text-xl font-bold">{results.overallStats.assessmentsTaken}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-xl font-bold">{results.overallStats.averageScore}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Latest Score</p>
              <p className="text-xl font-bold">{results.overallStats.percentage}%</p>
              <div className="mt-1">
                <Progress value={results.overallStats.percentage} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.overallStats.recentSubmissions.map((submission, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{submission.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(submission.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-slate-100 px-2 py-1 rounded-md text-sm font-medium">
                  {submission.score}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    
    <div className="mt-6 flex justify-end">
      <Button onClick={() => setActiveView("assessment")}>Back to Assessments</Button>
    </div>
  </div>
);
  
  // Main Assessment Component
  const AssessmentView = () => {
    if (!assessment) return <div>Loading assessment...</div>;
    
    const currentQ = assessment.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / assessment.questions.length) * 100;
    
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">AI Assessment Tool</h1>
          <div className="flex gap-2 items-center">
            <div className="bg-slate-100 px-3 py-1 rounded-md flex items-center gap-1">
              <span className="text-slate-800">Time:</span>
              <span className={`font-mono ${timeRemaining < 300 ? 'text-red-500' : ''}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Button variant="outline" size="icon" title="Accessibility options">
              <span className="sr-only">Accessibility options</span>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 1C6.67157 1 6 1.67157 6 2.5C6 3.32843 6.67157 4 7.5 4C8.32843 4 9 3.32843 9 2.5C9 1.67157 8.32843 1 7.5 1zM4.5 4C4.22386 4 4 4.22386 4 4.5C4 4.77614 4.22386 5 4.5 5H5.5C5.77614 5 6 4.77614 6 4.5C6 4.22386 5.77614 4 5.5 4H4.5zM9.5 4C9.22386 4 9 4.22386 9 4.5C9 4.77614 9.22386 5 9.5 5H10.5C10.7761 5 11 4.77614 11 4.5C11 4.22386 10.7761 4 10.5 4H9.5zM5 7C4.44772 7 4 7.44772 4 8C4 8.55228 4.44772 9 5 9H10C10.5523 9 11 8.55228 11 8C11 7.44772 10.5523 7 10 7H5zM7 10.5C7 10.2239 7.22386 10 7.5 10C7.77614 10 8 10.2239 8 10.5V12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5V10.5z" fill="currentColor"/>
              </svg>
            </Button>
          </div>
        </header>

        {/* Make sure the currentTab value is correctly set */}
        <Tabs value={currentTab} className="mb-6" onValueChange={setCurrentTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="mcq" disabled={currentQ.type !== "mcq"}>MCQ</TabsTrigger>
            <TabsTrigger value="descriptive" disabled={currentQ.type !== "descriptive"}>Descriptive</TabsTrigger>
            <TabsTrigger value="practical" disabled={currentQ.type !== "practical"}>Practical</TabsTrigger>
          </TabsList>

          <TabsContent value="mcq">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Question {currentQuestion + 1}: Multiple Choice</span>
                  <Button variant="ghost" size="icon" onClick={readQuestion}>
                    <Speaker className={isReading ? "text-primary animate-pulse" : ""} size={20} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p>{currentQ.question}</p>
                  
                  <RadioGroup value={mcqAnswer} onValueChange={value => updateAnswer(value)}>
                    {currentQ.options && currentQ.options.map((option, idx) => (
                      <div key={idx} className="flex items-center space-x-2 p-3 rounded-md border hover:bg-accent">
                        <RadioGroupItem value={option} id={`option${idx}`} />
                        <Label htmlFor={`option${idx}`} className="w-full cursor-pointer">{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  
                  <div className="flex space-x-2 justify-between">
                    <Button variant="outline" onClick={() => goToQuestion(currentQuestion - 1)} disabled={currentQuestion === 0}>Previous</Button>
                    {currentQuestion < assessment.questions.length - 1 ? (
                      <Button onClick={() => goToQuestion(currentQuestion + 1)}>Next</Button>
                    ) : (
                      <Button onClick={handleSubmitAssessment} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit Test"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="descriptive">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Question {currentQuestion + 1}: Descriptive</span>
                  <Button variant="ghost" size="icon" onClick={readQuestion}>
                    <Speaker className={isReading ? "text-primary animate-pulse" : ""} size={20} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p>{currentQ.question}</p>
                  
                  <div className="relative">
                    <Textarea 
                      placeholder="Type your answer here..." 
                      value={userAnswer}
                      onChange={(e) => updateAnswer(e.target.value)}
                      className="min-h-[150px]"
                    />
                    <div className="absolute bottom-2 right-2 flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        className={isListening ? "bg-primary text-white" : ""}
                        onClick={toggleSpeechRecognition}>
                        <Mic size={18} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 justify-between">
                    <Button variant="outline" onClick={() => goToQuestion(currentQuestion - 1)} disabled={currentQuestion === 0}>Previous</Button>
                    {currentQuestion < assessment.questions.length - 1 ? (
                      <Button onClick={() => goToQuestion(currentQuestion + 1)}>Next</Button>
                    ) : (
                      <Button onClick={handleSubmitAssessment} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit Test"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="practical">
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Question {currentQuestion + 1}: Practical</span>
                  <Button variant="ghost" size="icon" onClick={readQuestion}>
                    <Speaker className={isReading ? "text-primary animate-pulse" : ""} size={20} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p>{currentQ.question}</p>
                  
                  <div className="border rounded-md p-4 bg-black text-white font-mono h-[150px] overflow-y-auto">
                    <Textarea 
                      className="bg-transparent resize-none border-0 h-full focus:ring-0"
                      value={userAnswer}
                      onChange={(e) => updateAnswer(e.target.value)}
                      placeholder="# Enter your code here"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" className="flex items-center gap-2">
                      <FileUp size={16} />
                      <span>Upload File</span>
                    </Button>
                    <Button variant="outline">Run Code</Button>
                  </div>
                  
                  <div className="flex space-x-2 justify-between">
                    <Button variant="outline" onClick={() => goToQuestion(currentQuestion - 1)} disabled={currentQuestion === 0}>Previous</Button>
                    {currentQuestion < assessment.questions.length - 1 ? (
                      <Button onClick={() => goToQuestion(currentQuestion + 1)}>Next</Button>
                    ) : (
                      <Button onClick={handleSubmitAssessment} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit Test"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

         
        </Tabs>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assessment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{currentQuestion + 1}/{assessment.questions.length} questions</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  return (
    <div>
      {activeView === "assessment" && <AssessmentView />}
      {activeView === "results" && <ResultsView />}
    </div>
  );
}