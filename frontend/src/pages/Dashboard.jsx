/*
* ======================================================================
* NEW "Mobile-First" Layout with Responsive Navigation:
*
* - On Mobile: A bottom navigation bar (like a native app).
* - On Desktop: A sticky top navigation bar (like a SaaS app).
* - NO SIDEBAR.
* ======================================================================
*/

import React, { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { useUserStore } from "../store/userStore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// --- I've added new icons for the new navigation ---
const IconLogo = () => (
    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);
const IconScan = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
    </svg>
);
const IconLogout = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);
const IconHome = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6-4h.01M12 12h.01M15 12h.01M12 15h.01M15 15h.01M9 15h.01" />
    </svg>
);
const IconUserCircle = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
// --- End of Icons ---


const Dashboard = () => {
    const { currentUser, logout } = useAuthStore();
    const {
        qrCodeUrl,
        walletBalance,
        collections,
        fetchQR,
        fetchWallet,
        fetchCollections,
        updateProfile,
    } = useUserStore();

    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        name: "",
        street: "",
        city: "",
        state: "",
        pinCode: "",
    });

    // --- Camera & AI State ---
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (currentUser) {
            fetchQR();
            fetchWallet();
            fetchCollections();

            setProfileData({
                name: currentUser.name || "",
                street: currentUser.address?.street || "",
                city: currentUser.address?.city || "",
                state: currentUser.address?.state || "",
                pinCode: currentUser.address?.pinCode || "",
            });
        }
    }, [currentUser, fetchQR, fetchWallet, fetchCollections]);

    // --- Camera Stream Effect ---
    useEffect(() => {
        const startStream = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setCameraError("Could not access camera. Please check browser permissions.");
            }
        };

        const stopStream = () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                setStream(null);
            }
        };

        if (isCameraOpen) {
            if (!capturedImage) {
                startStream();
            }
        } else {
            stopStream();
        }

        return () => {
            stopStream();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCameraOpen, capturedImage]);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const handleInputChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        const res = await updateProfile(profileData);
        if (res?.user) {
            setIsEditing(false);
        }
    };

    // --- Camera Handlers ---

    const handleOpenCamera = () => {
        setIsCameraOpen(true);
        setCapturedImage(null);
        setAnalysisResult(null);
        setCameraError(null);
    };

    const handleCloseCamera = () => {
        setIsCameraOpen(false);
        setCapturedImage(null);
        setAnalysisResult(null);
        setCameraError(null);
    };

    const handleCaptureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setCapturedImage(dataUrl);
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                setStream(null);
            }
        }
    };

    const handleRetakeImage = () => {
        setCapturedImage(null);
        setAnalysisResult(null);
        setCameraError(null);
    };

    const handleAnalyzeImage = async () => {
        if (!capturedImage) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);
        setCameraError(null);

        const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

        if (GOOGLE_VISION_API_KEY === "YOUR_NEW_GOOGLE_VISION_API_KEY") {
            setCameraError("Analysis failed: Please add your Google Cloud Vision API key to Dashboard.js.");
            setIsAnalyzing(false);
            return;
        }

        const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
        const base64Data = capturedImage.split(',')[1];

        const requestBody = {
            requests: [
                {
                    image: { content: base64Data },
                    features: [
                        { type: "LABEL_DETECTION", maxResults: 10 },
                        { type: "OBJECT_LOCALIZATION", maxResults: 10 }
                    ],
                },
            ],
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Response:", errorData);
                throw new Error(errorData.error.message || `API request failed with status ${response.status}`);
            }

            const data = await response.json();

            if (!data.responses || data.responses.length === 0 || data.responses[0].error) {
                console.warn("Analysis returned an error:", data.responses[0].error);
                setCameraError(`Analysis failed: ${data.responses[0].error.message}`);
                setIsAnalyzing(false);
                return;
            }

            const { labelAnnotations, localizedObjectAnnotations } = data.responses[0];

            if (!labelAnnotations && !localizedObjectAnnotations) {
                setCameraError("Analysis complete, but no objects or labels were recognized.");
                setIsAnalyzing(false);
                return;
            }

            const skipList = ['person', 'hand', 'arm', 'man', 'woman', 'finger', 'clothing', 'skin'];
            let bestGuess = null;
            const allLabels = [];

            if (localizedObjectAnnotations && localizedObjectAnnotations.length > 0) {
                for (const obj of localizedObjectAnnotations) {
                    allLabels.push(obj.name);
                    if (!bestGuess && !skipList.includes(obj.name.toLowerCase())) {
                        bestGuess = obj.name;
                    }
                }
            }

            if (!bestGuess && labelAnnotations && labelAnnotations.length > 0) {
                for (const label of labelAnnotations) {
                    allLabels.push(label.description);
                    if (!bestGuess && !skipList.includes(label.description.toLowerCase())) {
                        bestGuess = label.description;
                    }
                }
            }

            if (!bestGuess) {
                bestGuess = (localizedObjectAnnotations && localizedObjectAnnotations[0].name) ||
                    (labelAnnotations && labelAnnotations[0].description) ||
                    "Could not identify object.";
            }

            const getWasteType = (item) => {
                const itemLower = item.toLowerCase().trim();
                const skipList = ['person', 'people', 'human', 'man', 'woman', 'child', 'baby', 'hand', 'hands', 'arm', 'arms', 'finger', 'fingers', 'face', 'head', 'body', 'leg', 'legs', 'clothing', 'clothes', 'shirt', 'pants', 'dress', 'jacket', 'shoe', 'shoes', 'skin', 'hair', 'eye', 'eyes', 'pet', 'dog', 'cat', 'animal', 'living'];
                if (skipList.some(term => itemLower === term || itemLower.includes(term))) return "Not Waste";
                const hazardousTerms = ['battery', 'batteries', 'lithium', 'alkaline', 'button cell', 'e-waste', 'electronic', 'electronics', 'phone', 'smartphone', 'tablet', 'laptop', 'computer', 'monitor', 'tv', 'television', 'printer', 'scanner', 'keyboard', 'mouse', 'charger', 'adapter', 'wire', 'cable', 'circuit', 'motherboard', 'processor', 'hard drive', 'usb', 'hdmi', 'vga', 'syringe', 'needle', 'medicine', 'medication', 'pill', 'tablet', 'capsule', 'pharmaceutical', 'drug', 'bandage', 'dressing', 'gauze', 'medical', 'thermometer', 'blood', 'pathological', 'biohazard', 'chemical', 'paint', 'varnish', 'stain', 'solvent', 'thinner', 'aerosol', 'spray paint', 'pesticide', 'herbicide', 'insecticide', 'fertilizer', 'cleaner', 'detergent', 'bleach', 'ammonia', 'acid', 'base', 'toxic', 'poison', 'hazardous', 'flammable', 'corrosive', 'reactiv', 'radioactive', 'light bulb', 'fluorescent', 'cfl', 'led bulb', 'mercury', 'asbestos', 'propane', 'butane', 'gasoline', 'oil', 'motor oil', 'transmission fluid', 'antifreeze', 'brake fluid'];
                const wetWasteTerms = ['food', 'fruit', 'vegetable', 'peel', 'core', 'seed', 'leftover', 'scrap', 'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'berry', 'strawberry', 'blueberry', 'raspberry', 'melon', 'watermelon', 'cantaloupe', 'pineapple', 'mango', 'peach', 'pear', 'plum', 'cherry', 'kiwi', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'lettuce', 'spinach', 'broccoli', 'cauliflower', 'cabbage', 'cucumber', 'pepper', 'corn', 'bean', 'pea', 'mushroom', 'herb', 'spice', 'meat', 'beef', 'chicken', 'pork', 'fish', 'seafood', 'egg', 'eggs', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'bread', 'pastry', 'cake', 'cookie', 'cracker', 'pasta', 'rice', 'cereal', 'flour', 'grain', 'oatmeal', 'organic', 'compost', 'compostable', 'biodegradable', 'plant', 'flower', 'leaf', 'leaves', 'grass', 'weed', 'tree', 'wood', 'bark', 'twig', 'coffee', 'coffee ground', 'tea', 'tea bag', 'tea leaf'];
                const dryWasteTerms = ['paper', 'cardboard', 'carton', 'box', 'newspaper', 'magazine', 'book', 'notebook', 'envelope', 'letter', 'mail', 'brochure', 'flyer', 'card', 'tissue', 'paper towel', 'napkin', 'wrapper', 'packaging', 'plastic', 'bottle', 'container', 'bag', 'wrapper', 'packaging', 'polyethylene', 'pet', 'hdpe', 'pvc', 'ldpe', 'pp', 'ps', 'styrofoam', 'foam', 'cup', 'plate', 'utensil', 'straw', 'lid', 'glass', 'bottle', 'jar', 'container', 'pane', 'mirror', 'metal', 'aluminum', 'steel', 'tin', 'can', 'container', 'foil', 'hardware', 'nail', 'screw', 'bolt', 'wire', 'hanger', 'textile', 'fabric', 'cloth', 'towel', 'blanket', 'curtain', 'rubber', 'tire', 'balloon', 'glove', 'ceramic', 'porcelain', 'pottery', 'leather', 'wallet', 'belt', 'bag', 'wood', 'lumber', 'furniture'];
                const specialTerms = { 'construction': 'Construction Waste', 'demolition': 'Construction Waste', 'concrete': 'Construction Waste', 'brick': 'Construction Waste', 'drywall': 'Construction Waste', 'insulation': 'Construction Waste', 'roofing': 'Construction Waste', 'lDumber': 'Construction Waste', 'furniture': 'Bulky Waste', 'mattress': 'Bulky Waste', 'appliance': 'Bulky Waste', 'refrigerator': 'Bulky Waste', 'washer': 'Bulky Waste', 'dryer': 'Bulky Waste', 'oven': 'Bulky Waste', 'diaper': 'Sanitary Waste', 'sanitary': 'Sanitary Waste', 'feminine': 'Sanitary Waste', 'tampon': 'Sanitary Waste', 'pad': 'Sanitary Waste' };
                for (const [term, category] of Object.entries(specialTerms)) {
                    if (itemLower.includes(term)) return category;
                }
                if (hazardousTerms.some(term => itemLower.includes(term))) return "Hazardous Waste";
                if (wetWasteTerms.some(term => itemLower.includes(term))) return "Wet Waste";
                if (dryWasteTerms.some(term => itemLower.includes(term))) return "Dry Waste";
                return "Not Waste";
            };

            const wasteType = getWasteType(bestGuess);
            const resultText = `Object Identified: ${bestGuess}\nWaste Type: ${wasteType}\n\nAll labels found: ${[...new Set(allLabels)].slice(0, 5).join(', ')}`;
            setAnalysisResult(resultText);

        } catch (err) {
            console.error("Error analyzing image:", err);
            setCameraError(`Analysis failed: ${err.message}. Check your API key and network.`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- Animation Variants ---
    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                delayChildren: 0.3,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100
            }
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500/20 text-green-300';
            case 'in-progress':
                return 'bg-yellow-500/20 text-yellow-300';
            default:
                return 'bg-blue-500/20 text-blue-300';
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-sans">

            {/* --- NEW: Top Navigation (Desktop) --- */}
            <nav className="hidden md:flex sticky top-0 z-30 w-full items-center justify-between bg-slate-800/70 backdrop-blur-lg p-5 border-b border-slate-700">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <IconLogo />
                    <span className="text-2xl font-bold text-white tracking-tight">EcoTrack</span>
                </div>

                {/* Desktop Actions */}
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-300">
                        Hello, <span className="font-medium text-white">{currentUser?.name || "Eco Warrior"}</span>
                    </span>
                    <button
                        onClick={handleOpenCamera}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition duration-200 shadow-lg hover:shadow-green-500/30"
                    >
                        <IconScan />
                        <span>Scan Waste</span>
                    </button>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition duration-200"
                        title="Edit Profile"
                    >
                        <IconUserCircle />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:bg-slate-700 hover:text-red-400 rounded-lg transition duration-200"
                    >
                        <IconLogout />
                    </button>
                </div>
            </nav>

            {/* --- Main Content Area --- */}
            {/* Added pb-24 to account for the fixed bottom nav on mobile */}
            <main className="flex-1 overflow-y-auto p-4 md:p-10 pb-24">
                {/* Header (Hidden on Desktop since nav has name) */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6 md:hidden" // Only show on mobile
                >
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
                        Welcome back,
                    </h1>
                    <p className="text-3xl font-bold text-green-400 tracking-tight">
                        {currentUser?.name || "Eco Warrior"}! 🌱
                    </p>
                </motion.div>

                {/* --- Main Grid (Wallet & QR) --- */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    {/* Wallet Card */}
                    <motion.div
                        className="md:col-span-2 bg-slate-800 rounded-2xl shadow-xl p-6 md:p-8 transition-all duration-300 hover:shadow-green-500/10 hover:-translate-y-1"
                        variants={itemVariants}
                    >
                        <h2 className="text-lg font-semibold text-slate-300 flex items-center mb-4">
                            <span className="mr-2">💰</span> Wallet Balance
                        </h2>
                        <p className="text-5xl md:text-6xl font-bold text-green-400 tracking-tight">
                            ₹{Number(walletBalance).toFixed(3)}
                        </p>
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <p className="text-sm text-slate-400">ECO Credits earned from successful collections.</p>
                        </div>
                    </motion.div>

                    {/* QR Code Card */}
                    <motion.div
                        className="bg-slate-800 rounded-2xl shadow-xl p-6 md:p-8 flex flex-col items-center justify-center transition-all duration-300 hover:shadow-blue-500/10 hover:-translate-y-1"
                        variants={itemVariants}
                    >
                        <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center">
                            <span className="mr-2">🔍</span> Your QR Code
                        </h2>
                        {qrCodeUrl ? (
                            <div className="p-3 bg-white rounded-xl shadow-inner">
                                <img
                                    src={qrCodeUrl}
                                    alt="QR Code"
                                    className="w-32 h-32 md:w-40 md:h-40 object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-36 h-36 md:w-44 md:h-44 bg-slate-700 rounded-xl flex items-center justify-center">
                                <p className="text-slate-400 text-sm text-center">Loading QR...</p>
                            </div>
                        )}
                        <p className="text-sm text-slate-400 mt-4 text-center">
                            Show this to the transporter to verify your collection.
                        </p>
                    </motion.div>
                </motion.div>

                {/* --- Collections History Table --- */}
                <motion.div
                    className="bg-slate-800 rounded-2xl shadow-xl p-4 md:p-8"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex items-center justify-between mb-6 px-2 md:px-0">
                        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center">
                            <span className="mr-3">📦</span> Collection History
                        </h2>
                        <span className="bg-slate-700 text-slate-300 text-xs md:text-sm font-medium px-3 py-1 rounded-full">
                            {collections.length} Collections
                        </span>
                    </div>

                    {collections.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-left">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Transporter</th>
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider text-right">Wet (kg)</th>
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider text-right">Dry (kg)</th>
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider text-right">Hazardous (kg)</th>
                                        <th className="p-3 md:p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider text-right">Total (kg)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {collections.map((c) => (
                                        <motion.tr
                                            key={c._id}
                                            className="hover:bg-slate-700/50"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.1 }}
                                        >
                                            <td className="p-3 md:p-4 whitespace-nowrap text-slate-300">{new Date(c.createdAt).toLocaleDateString()}</td>
                                            <td className="p-3 md:p-4 whitespace-nowrap text-slate-300">{c.transporter?.name || "N/A"}</td>
                                            <td className="p-3 md:p-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(c.status)}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="p-3 md:p-4 whitespace-nowrap text-slate-300 text-right">{c.wasteTypes?.wet || 0}</td>
                                            <td className="p-3 md:p-4 whitespace-nowrap text-slate-300 text-right">{c.wasteTypes?.dry || 0}</td>
                                            <td className="p-3 md:p-4 whitespace-nowrap text-slate-300 text-right">{c.wasteTypes?.hazardous || 0}</td>
                                            <td className="p-3 md:p-4 whitespace-nowrap text-green-400 font-bold text-right">{c.weight}</td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <motion.div
                            className="text-center py-16"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-lg font-medium text-white mb-2">No collections yet</h3>
                            <p className="text-slate-400">Your waste collection history will appear here once you scan.</p>
                        </motion.div>
                    )}
                </motion.div>
            </main>

            {/* --- NEW: Bottom Navigation (Mobile) --- */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-slate-800/70 backdrop-blur-lg border-t border-slate-700 flex items-center justify-around">
                {/* Home Button */}
                <button className="flex flex-col items-center justify-center text-slate-400 hover:text-green-400 transition-colors">
                    <IconHome />
                    <span className="text-xs font-medium">Home</span>
                </button>

                {/* Scan Button (Elevated) */}
                <button
                    onClick={handleOpenCamera}
                    className="w-16 h-16 -translate-y-6 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30"
                >
                    <IconScan />
                </button>

                {/* Profile Button */}
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex flex-col items-center justify-center text-slate-400 hover:text-green-400 transition-colors"
                >
                    <IconUserCircle />
                    <span className="text-xs font-medium">Profile</span>
                </button>
            </nav>


            {/* --- Dark Mode Edit Profile Modal --- */}
            {isEditing && (
                <motion.div
                    className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <motion.div
                        className="bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md border border-slate-700"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center">
                                <span className="mr-2">✏️</span> Edit Profile
                            </h2>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-slate-500 hover:text-slate-300 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            {[
                                { name: "name", placeholder: "Full Name", icon: "👤" },
                                { name: "street", placeholder: "Street Address", icon: "📍" },
                                { name: "city", placeholder: "City", icon: "🏙️" },
                                { name: "state", placeholder: "State", icon: "🗺️" },
                                { name: "pinCode", placeholder: "PIN Code", icon: "📮" }
                            ].map((field) => (
                                <div key={field.name} className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-slate-400">{field.icon}</span>
                                    </div>
                                    <input
                                        type="text"
                                        name={field.name}
                                        value={profileData[field.name]}
                                        onChange={handleInputChange}
                                        placeholder={field.placeholder}
                                        className="w-full pl-10 bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                            ))}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-5 py-2 bg-slate-600 text-slate-100 rounded-lg font-medium hover:bg-slate-500 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition flex items-center"
                                >
                                    <span className="mr-2">💾</span> Save Changes
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}

            {/* Hidden Canvas for Image Capture */}
            <canvas ref={canvasRef} className="hidden"></canvas>

            {/* --- Dark Mode Camera Modal --- */}
            {isCameraOpen && (
                <motion.div
                    className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <motion.div
                        className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-700"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white tracking-tight flex items-center">
                                <span className="mr-2">♻️</span> Waste Scanner
                            </h2>
                            <button
                                onClick={handleCloseCamera}
                                className="text-slate-500 hover:text-slate-300 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4 shadow-inner">
                            {!capturedImage ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className={`w-full h-full object-cover ${cameraError ? 'hidden' : ''}`}
                                ></video>
                            ) : (
                                <img
                                    src={capturedImage}
                                    alt="Captured waste"
                                    className="w-full h-full object-contain"
                                />
                            )}
                        </div>

                        <div className="flex justify-center gap-4 mb-4">
                            {!capturedImage ? (
                                <button
                                    onClick={handleCaptureImage}
                                    disabled={!!cameraError || !stream}
                                    className="w-20 h-20 bg-white border-4 border-green-500 rounded-full flex items-center justify-center text-3xl shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:border-gray-500"
                                    title="Capture Photo"
                                >
                                    <span className="w-16 h-16 bg-green-500 rounded-full"></span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleRetakeImage}
                                        disabled={isAnalyzing}
                                        className="px-5 py-3 bg-slate-600 text-slate-100 rounded-lg font-medium hover:bg-slate-500 transition disabled:opacity-50"
                                    >
                                        Retake
                                    </button>
                                    <button
                                        onClick={handleAnalyzeImage}
                                        disabled={isAnalyzing}
                                        className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:bg-blue-400 flex items-center"
                                    >
                                        {isAnalyzing ? "Analyzing..." : "Analyze Waste"}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="mt-4 min-h-[6rem]">
                            {isAnalyzing && (
                                <div className="text-center text-slate-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                                    <p className="mt-2 font-medium">AI is thinking...</p>
                                </div>
                            )}

                            {cameraError && !isAnalyzing && (
                                <div className="bg-red-500/20 border border-red-700 text-red-300 rounded-lg p-3 text-center">
                                    {cameraError}
                                </div>
                            )}

                            {analysisResult && !isAnalyzing && (
                                <motion.div
                                    className="bg-green-500/20 rounded-lg p-4 border border-green-700"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <h3 className="font-bold text-lg text-green-300 mb-2">Analysis Result</h3>
                                    <p className="text-slate-100 whitespace-pre-line">{analysisResult}</p>
                                </motion.div>
                            )}
                        </div>

                    </motion.div>
                </motion.div>
            )}

        </div>
    );
};

export default Dashboard;