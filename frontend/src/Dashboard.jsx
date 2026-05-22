import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { UploadCloud, CheckCircle, AlertTriangle, Activity, Scan, FileImage, LogOut, HeartPulse, ArrowRight, Stethoscope, Phone, ShieldAlert, MapPin, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NeuralBackground from './NeuralBackground';
import Chatbot from './Chatbot';
import { useToast } from './Toast';
import ScanHistory, { saveScanToHistory } from './ScanHistory';
import HealthTips from './HealthTips';

function Dashboard() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const addToast = useToast();

  // Mouse tracking logic for dynamic effects
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothMouseX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const smoothMouseY = useSpring(mouseY, { damping: 50, stiffness: 400 });

  // Transform coordinates for parallax shifts
  const bgShiftX = useTransform(smoothMouseX, [-0.5, 0.5], [-30, 30]);
  const bgShiftY = useTransform(smoothMouseY, [-0.5, 0.5], [-30, 30]);
  
  const cardTiltX = useTransform(smoothMouseY, [-0.5, 0.5], [5, -5]);
  const cardTiltY = useTransform(smoothMouseX, [-0.5, 0.5], [-5, 5]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mouseX.set(e.clientX / innerWidth - 0.5);
      mouseY.set(e.clientY / innerHeight - 0.5);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  const steps = [
    "Waking up Deep Learning Model...",
    "Enhancing Ultrasound Contrast...",
    "Scanning for Nodules...",
    "Running EfficientNetB3 AI...",
    "Finalizing Health Report..."
  ];

  useEffect(() => {
    let timer;
    if (isAnalyzing && analysisStep < steps.length - 1) {
      timer = setTimeout(() => {
        setAnalysisStep(prev => prev + 1);
      }, 700);
    }
    return () => clearTimeout(timer);
  }, [isAnalyzing, analysisStep]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setAnalysisStep(0);
      addToast({ type: 'info', title: 'Image Selected', message: `${file.name} is ready for analysis.` });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isAnalyzing) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isAnalyzing) return;
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setAnalysisStep(0);
      addToast({ type: 'info', title: 'Image Uploaded', message: `${file.name} is ready for analysis.` });
    } else {
      addToast({ type: 'error', title: 'Invalid File', message: 'Please drop a valid image file.' });
    }
  };

  const loadSampleImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500; canvas.height = 500;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(250, 250, 50, 250, 250, 250);
    gradient.addColorStop(0, '#475569');
    gradient.addColorStop(1, '#020617');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 500, 500);
    
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(250, 250, 80, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sample Ultrasound', 250, 50);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], "sample_scan.jpg", { type: "image/jpeg" });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setAnalysisStep(0);
      addToast({ type: 'info', title: 'Sample Loaded', message: 'Demo image is ready for analysis.' });
    }, 'image/jpeg');
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisStep(0);
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await new Promise(r => setTimeout(r, 1500));
      const response = await axios.post('http://127.0.0.1:8000/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
      window.dispatchEvent(new Event('scan_saved'));
      
      addToast({ 
        type: response.data.prediction.toLowerCase().includes('abnormal') ? 'error' : 'success', 
        title: 'Analysis Complete', 
        message: 'Scan has been successfully analyzed.' 
      });
    } catch (error) {
      setResult({
        prediction: "Connection Error",
        confidence: 0,
        message: "Failed to connect to AI server."
      });
      addToast({ type: 'error', title: 'Analysis Failed', message: 'Could not connect to the diagnostic server.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetScan = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setAnalysisStep(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    addToast({ type: 'info', title: 'Reset Complete', message: 'Ready for a new scan.' });
  };

  const downloadReport = () => {
    if (!result) return;
    const content = `Thyroid Ultrasound Analysis Report
----------------------------------
Date: ${new Date().toLocaleString()}
Prediction: ${result.prediction}
Confidence: ${result.confidence}%
Level: ${result.level || 'N/A'}

AI Insights:
${result.message}

Recommended Consultations:
${result.doctors?.length ? result.doctors.map(d => `- ${d.name} | ${d.hospital} | Phone: ${d.phone}`).join('\n') : 'None'}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Thyroid_Report_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Report Downloaded', message: 'Your diagnostic report has been saved.' });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto relative font-sans perspective-1000">
      
      {/* Dynamic Parallax Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <NeuralBackground />
        <motion.div 
          style={{ x: bgShiftX, y: bgShiftY }}
          className="absolute inset-0 w-full h-full"
        >
          <motion.div 
            animate={{ scale: [1, 1.2, 1], borderRadius: ["30%", "50%", "30%"] }} 
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-blue-600/10 blur-[120px] mix-blend-screen"
          />
          <motion.div 
            animate={{ scale: [1, 1.4, 1], borderRadius: ["50%", "30%", "50%"] }} 
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-purple-600/10 blur-[120px] mix-blend-screen"
          />
        </motion.div>
      </div>

      {/* Navbar */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{ rotateX: cardTiltX, rotateY: cardTiltY }}
        className="w-full max-w-6xl flex justify-between items-center mb-8 z-20 bg-white/5 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Thyroid AI</span>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/')}
          className="flex items-center gap-2 bg-white/5 text-slate-300 px-4 py-2 rounded-xl border border-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign Out</span>
        </motion.button>
      </motion.div>

      {/* Main Glassmorphism Panel with 3D Tilt */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ rotateX: cardTiltX, rotateY: cardTiltY, transformStyle: "preserve-3d" }}
        transition={{ type: "spring", bounce: 0.3 }}
        className="w-full max-w-6xl z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 relative"
      >
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)]"></div>
        
        {/* Glass reflection highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>
        
        {/* Left Column: Interactive Uploader */}
        <motion.div style={{ transform: "translateZ(30px)" }} className="flex flex-col h-full bg-slate-950/40 rounded-3xl p-6 border border-white/5 m-6 lg:mr-0 z-20">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileImage className="text-blue-400 w-5 h-5" /> Image Input
             </h2>
             <div className="flex gap-2">
               {previewUrl && (
                 <motion.button 
                   whileHover={{ scale: 1.05 }}
                   onClick={resetScan} 
                   className="text-xs font-semibold bg-slate-500/10 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-500/20 hover:bg-slate-500/20 hover:text-white transition-colors flex items-center gap-1.5"
                 >
                   <RefreshCw className="w-3 h-3" /> Reset
                 </motion.button>
               )}
               <motion.button 
                 whileHover={{ scale: 1.05 }}
                 onClick={loadSampleImage} 
                 className="text-xs font-semibold bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
               >
                 Load Demo Image
               </motion.button>
             </div>
          </div>
          
          <div 
            onClick={() => !isAnalyzing && fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex-1 rounded-[2rem] flex flex-col items-center justify-center p-2 transition-all duration-300 overflow-hidden group ${
              isAnalyzing ? 'cursor-not-allowed border-2 border-blue-500/30 bg-blue-900/10' :
              isDragging ? 'bg-blue-900/20 border-2 border-dashed border-blue-500 scale-[1.02]' :
              previewUrl ? 'bg-black/50 cursor-pointer border-2 border-transparent hover:border-white/10' : 
              'border-2 border-dashed border-slate-700 bg-slate-900/50 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/50'
            }`}
          >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isAnalyzing} />
            
            {previewUrl ? (
              <div className="relative w-full h-full min-h-[350px] flex items-center justify-center rounded-[1.5rem] overflow-hidden">
                <motion.img 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  src={previewUrl} alt="Preview" className="max-h-[400px] object-contain rounded-2xl z-10" 
                />
                
                <AnimatePresence>
                  {isAnalyzing && (
                    <>
                      <motion.div 
                        initial={{ top: "-10%" }} animate={{ top: "110%" }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,1)] z-20"
                      />
                      <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay z-10 animate-pulse"></div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center py-20 px-10 text-center pointer-events-none">
                <motion.div 
                  animate={isDragging ? { scale: 1.1, y: -10 } : { scale: 1, y: 0 }}
                  whileHover={{ scale: 1.1, rotate: 5, y: -5 }} 
                  className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-xl border transition-colors ${
                    isDragging ? 'bg-blue-600/20 border-blue-500/50' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/50 group-hover:border-blue-500/30'
                  }`}
                >
                  <UploadCloud className={`w-12 h-12 transition-colors ${isDragging ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'}`} />
                </motion.div>
                <p className="text-white font-bold text-xl mb-2 tracking-tight">Drop Ultrasound Scan</p>
                <p className="text-slate-500 text-sm">JPG or PNG • High Resolution</p>
              </div>
            )}
          </div>

          <motion.button 
            whileHover={(!selectedFile || isAnalyzing) ? {} : { scale: 1.02 }}
            whileTap={(!selectedFile || isAnalyzing) ? {} : { scale: 0.98 }}
            onClick={analyzeImage}
            disabled={!selectedFile || isAnalyzing}
            className={`mt-6 w-full py-4 rounded-[1.25rem] font-bold text-lg transition-all flex items-center justify-center space-x-3 relative overflow-hidden ${
              !selectedFile 
                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                : isAnalyzing
                ? 'bg-blue-600/80 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] cursor-wait backdrop-blur-md'
                : 'bg-white text-slate-900 hover:bg-slate-100 shadow-[0_0_40px_rgba(255,255,255,0.2)]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Scan className="w-6 h-6 animate-[spin_3s_linear_infinite]" />
                <span className="tracking-wide">AI Processing...</span>
              </>
            ) : (
              <span className="tracking-wide flex items-center gap-2">Start Deep Scan <ArrowRight className="w-5 h-5"/></span>
            )}
          </motion.button>
        </motion.div>

        {/* Right Column: Dynamic Results Panel */}
        <motion.div style={{ transform: "translateZ(30px)" }} className="flex flex-col h-full bg-slate-950/40 rounded-3xl p-6 md:p-10 border border-white/5 relative overflow-y-auto overflow-x-hidden m-6 lg:ml-0 z-20">
          
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="text-purple-400 w-5 h-5" /> Analysis Dashboard
            </h2>
            
            {result && !isAnalyzing && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={downloadReport}
                className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Save Report
              </motion.button>
            )}
          </div>
          
          {!result && !isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-slate-700/50 flex items-center justify-center mb-6">
                <HeartPulse className="w-12 h-12 text-slate-600 stroke-[1.5]" />
              </div>
              <p className="text-center font-medium text-lg">Awaiting Image Input</p>
              <p className="text-center text-sm text-slate-600 mt-2 max-w-xs">Upload a scan to initiate the AI diagnostic sequence.</p>
            </motion.div>
          )}

          {isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full relative z-10">
              <div className="flex justify-center mb-10">
                <div className="relative w-32 h-32">
                  <motion.div animate={{ scale: [1, 1.5], opacity: [1, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }} className="absolute inset-0 rounded-full border border-blue-500/50" />
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 backdrop-blur-sm flex items-center justify-center bg-blue-500/5">
                    <Activity className="w-10 h-10 text-blue-400 animate-pulse" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-5">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="relative">
                      {index < analysisStep ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </motion.div>
                      ) : index === analysisStep ? (
                        <div className="w-8 h-8 rounded-full border-2 border-blue-400 flex items-center justify-center bg-blue-900/30">
                          <motion.div animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-2.5 h-2.5 bg-blue-400 rounded-full" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-slate-700 bg-slate-800/50 flex items-center justify-center">
                          <div className="w-2 h-2 bg-slate-600 rounded-full" />
                        </div>
                      )}
                      {index < steps.length - 1 && (
                        <div className={`absolute top-8 left-[15px] w-0.5 h-5 -ml-[1px] ${index < analysisStep ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                      )}
                    </div>
                    <span className={`text-[15px] font-medium transition-all duration-300 ${index < analysisStep ? 'text-slate-300' : index === analysisStep ? 'text-white translate-x-1' : 'text-slate-600'}`}>{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {result && !isAnalyzing && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ type: "spring", damping: 20 }} className="flex flex-col h-full justify-between z-10 relative">
                <div>
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 blur-[80px] rounded-full pointer-events-none ${result.prediction.toLowerCase().includes('abnormal') ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}></div>

                  <div className={`p-8 rounded-[2rem] flex flex-col items-center text-center space-y-4 mb-8 relative overflow-hidden backdrop-blur-xl ${result.prediction.toLowerCase().includes('abnormal') ? 'bg-red-950/30 border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.15)]' : 'bg-emerald-950/30 border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)]'}`}>
                    <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }} className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-2xl ${result.prediction.toLowerCase().includes('abnormal') ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {result.prediction.toLowerCase().includes('abnormal') ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle className="w-10 h-10" />}
                    </motion.div>
                    <div className="pt-2">
                      <p className="text-slate-400 text-xs uppercase tracking-[0.2em] font-bold mb-2">Final Diagnosis</p>
                      <h3 className={`text-4xl font-extrabold tracking-tight ${result.prediction.toLowerCase().includes('abnormal') ? 'text-red-400' : 'text-emerald-400'}`}>{result.prediction}</h3>
                      {result.level && (
                        <div className="mt-4 inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
                          <ShieldAlert className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-bold tracking-wide">Severity Level: {result.level}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 mb-6 backdrop-blur-md">
                    <h4 className="text-white font-bold mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> AI Insights</h4>
                    <p className="text-slate-300 text-[15px] leading-relaxed">{result.message}</p>
                  </div>

                  {result.doctors && result.doctors.length > 0 && (
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 mb-6 backdrop-blur-md">
                      <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-purple-400" /> Recommended Nearby Consultations</h4>
                      <div className="space-y-4">
                        {result.doctors.map((doctor, idx) => (
                          <div key={idx} className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-2 transition-colors hover:bg-slate-800/80">
                            <div className="flex items-start justify-between">
                              <span className="text-white font-bold text-lg">{doctor.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                              <MapPin className="w-4 h-4" /> <span>{doctor.hospital}</span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-400 text-sm mt-1">
                              <Phone className="w-4 h-4" /> <span>{doctor.phone}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {result.confidence > 0 && (
                  <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                    <div className="flex justify-between mb-4 items-end">
                      <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">AI Confidence</span>
                      <span className="font-black text-white text-3xl">{result.confidence}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }} transition={{ duration: 2, ease: "circOut", delay: 0.5 }} className={`h-full rounded-full relative ${result.prediction.toLowerCase().includes('abnormal') ? 'bg-gradient-to-r from-red-600 to-rose-400' : 'bg-gradient-to-r from-emerald-600 to-teal-400'}`}>
                         <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                      </motion.div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
      
      {/* New Features Integration */}
      <ScanHistory />
      <HealthTips />

      {/* Floating Chatbot */}
      <Chatbot />
    </div>
  )
}

export default Dashboard
