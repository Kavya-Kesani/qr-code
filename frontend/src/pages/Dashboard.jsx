import React, { useEffect, useState, useRef } from "react"; // Added useRef
import { useAuthStore } from "../store/authStore";
import { useUserStore } from "../store/userStore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

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

    // --- NEW FEATURE: Camera & AI State ---
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null); // Will store the base64 image data
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null); // Hidden canvas for capturing the image
    // --- End of New Feature State ---

    useEffect(() => {
        if (currentUser) {
            fetchQR();
            fetchWallet();
            fetchCollections();

            // prefill form with existing data
            setProfileData({
                name: currentUser.name || "",
                street: currentUser.address?.street || "",
                city: currentUser.address?.city || "",
                state: currentUser.address?.state || "",
                pinCode: currentUser.address?.pinCode || "",
            });
        }
    }, [currentUser, fetchQR, fetchWallet, fetchCollections]); // Added store functions to dependency array

    // --- NEW FEATURE: Camera Stream Effect ---
    useEffect(() => {
        const startStream = async () => {
            try {
                // 'environment' prefers the back camera on mobile devices
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
            if (!capturedImage) { // Only start stream if we're not viewing a captured image
                startStream();
            }
        } else {
            stopStream();
        }

        // Cleanup function to stop the stream when component unmounts or modal closes
        return () => {
            stopStream();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCameraOpen, capturedImage]); // Re-runs when modal opens or user hits 'Retake'

    // --- End of New Feature Effect ---

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

    // --- NEW FEATURE: Camera Handlers ---

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
        // The useEffect cleanup will handle stopping the stream
    };

    const handleCaptureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;

            // Set canvas dimensions to match video feed
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw the current video frame onto the canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get the image as a base64 data URL
            const dataUrl = canvas.toDataURL('image/jpeg');
            setCapturedImage(dataUrl);

            // Stop the stream now that we have the image
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
        // The useEffect will see isCameraOpen=true and capturedImage=null,
        // so it will restart the stream automatically.
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
                    image: {
                        content: base64Data,
                    },
                    features: [
                        {
                            type: "LABEL_DETECTION",
                            maxResults: 10,
                        },
                        {
                            type: "OBJECT_LOCALIZATION", // This is better at finding specific items
                            maxResults: 10,
                        }
                    ],
                },
            ],
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
                        bestGuess = obj.name; // Found the first object that's not a person!
                    }
                }
            }

            // 2. If we still haven't found a good object, check the 'labelAnnotations'
            if (!bestGuess && labelAnnotations && labelAnnotations.length > 0) {
                for (const label of labelAnnotations) {
                    allLabels.push(label.description);
                    if (!bestGuess && !skipList.includes(label.description.toLowerCase())) {
                        bestGuess = label.description; // Found the first label that's not a person!
                    }
                }
            }

            // 3. If we *still* only found a person, just give up and show the first label
            if (!bestGuess) {
                bestGuess = (localizedObjectAnnotations && localizedObjectAnnotations[0].name) ||
                    (labelAnnotations && labelAnnotations[0].description) ||
                    "Could not identify object.";
            }

            // --- UPDATED Waste Type Logic (to match your categories) ---
            const getWasteType = (item) => {
                const itemLower = item.toLowerCase().trim();

                // Expanded skip list - items that are not waste
                const skipList = [
                    'person', 'people', 'human', 'man', 'woman', 'child', 'baby', 'hand', 'hands',
                    'arm', 'arms', 'finger', 'fingers', 'face', 'head', 'body', 'leg', 'legs',
                    'clothing', 'clothes', 'shirt', 'pants', 'dress', 'jacket', 'shoe', 'shoes',
                    'skin', 'hair', 'eye', 'eyes', 'pet', 'dog', 'cat', 'animal', 'living'
                ];

                // Check if it's not waste FIRST
                if (skipList.some(term => itemLower === term || itemLower.includes(term))) {
                    return "Not Waste";
                }

                // Hazardous Waste (including E-Waste, medical, chemicals)
                const hazardousTerms = [
                    // Batteries
                    'battery', 'batteries', 'lithium', 'alkaline', 'button cell',
                    // Electronics
                    'e-waste', 'electronic', 'electronics', 'phone', 'smartphone', 'tablet',
                    'laptop', 'computer', 'monitor', 'tv', 'television', 'printer', 'scanner',
                    'keyboard', 'mouse', 'charger', 'adapter', 'wire', 'cable', 'circuit',
                    'motherboard', 'processor', 'hard drive', 'usb', 'hdmi', 'vga',
                    // Medical
                    'syringe', 'needle', 'medicine', 'medication', 'pill', 'tablet', 'capsule',
                    'pharmaceutical', 'drug', 'bandage', 'dressing', 'gauze', 'medical',
                    'thermometer', 'blood', 'pathological', 'biohazard',
                    // Chemicals
                    'chemical', 'paint', 'varnish', 'stain', 'solvent', 'thinner', 'aerosol',
                    'spray paint', 'pesticide', 'herbicide', 'insecticide', 'fertilizer',
                    'cleaner', 'detergent', 'bleach', 'ammonia', 'acid', 'base', 'toxic',
                    'poison', 'hazardous', 'flammable', 'corrosive', 'reactiv', 'radioactive',
                    // Other hazardous
                    'light bulb', 'fluorescent', 'cfl', 'led bulb', 'mercury', 'asbestos',
                    'propane', 'butane', 'gasoline', 'oil', 'motor oil', 'transmission fluid',
                    'antifreeze', 'brake fluid'
                ];

                // Wet/Organic Waste
                const wetWasteTerms = [
                    // Food items
                    'food', 'fruit', 'vegetable', 'peel', 'core', 'seed', 'leftover', 'scrap',
                    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'berry', 'strawberry',
                    'blueberry', 'raspberry', 'melon', 'watermelon', 'cantaloupe', 'pineapple',
                    'mango', 'peach', 'pear', 'plum', 'cherry', 'kiwi', 'avocado',
                    'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'lettuce',
                    'spinach', 'broccoli', 'cauliflower', 'cabbage', 'cucumber', 'pepper',
                    'corn', 'bean', 'pea', 'mushroom', 'herb', 'spice',
                    // Meat & Dairy
                    'meat', 'beef', 'chicken', 'pork', 'fish', 'seafood', 'egg', 'eggs',
                    'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream',
                    // Bread & Grains
                    'bread', 'pastry', 'cake', 'cookie', 'cracker', 'pasta', 'rice', 'cereal',
                    'flour', 'grain', 'oatmeal',
                    // Other organic
                    'organic', 'compost', 'compostable', 'biodegradable', 'plant', 'flower',
                    'leaf', 'leaves', 'grass', 'weed', 'tree', 'wood', 'bark', 'twig',
                    'coffee', 'coffee ground', 'tea', 'tea bag', 'tea leaf'
                ];

                // Dry/Recyclable Waste
                const dryWasteTerms = [
                    // Paper products
                    'paper', 'cardboard', 'carton', 'box', 'newspaper', 'magazine', 'book',
                    'notebook', 'envelope', 'letter', 'mail', 'brochure', 'flyer', 'card',
                    'tissue', 'paper towel', 'napkin', 'wrapper', 'packaging',
                    // Plastic
                    'plastic', 'bottle', 'container', 'bag', 'wrapper', 'packaging',
                    'polyethylene', 'pet', 'hdpe', 'pvc', 'ldpe', 'pp', 'ps', 'styrofoam',
                    'foam', 'cup', 'plate', 'utensil', 'straw', 'lid',
                    // Glass
                    'glass', 'bottle', 'jar', 'container', 'pane', 'mirror',
                    // Metal
                    'metal', 'aluminum', 'steel', 'tin', 'can', 'container', 'foil',
                    'hardware', 'nail', 'screw', 'bolt', 'wire', 'hanger',
                    // Other dry waste
                    'textile', 'fabric', 'cloth', 'towel', 'blanket', 'curtain',
                    'rubber', 'tire', 'balloon', 'glove',
                    'ceramic', 'porcelain', 'pottery',
                    'leather', 'wallet', 'belt', 'bag',
                    'wood', 'lumber', 'furniture'
                ];

                // Special categories
                const specialTerms = {
                    // Construction waste
                    'construction': 'Construction Waste',
                    'demolition': 'Construction Waste',
                    'concrete': 'Construction Waste',
                    'brick': 'Construction Waste',
                    'drywall': 'Construction Waste',
                    'insulation': 'Construction Waste',
                    'roofing': 'Construction Waste',
                    'lumber': 'Construction Waste',

                    // Bulky items
                    'furniture': 'Bulky Waste',
                    'mattress': 'Bulky Waste',
                    'appliance': 'Bulky Waste',
                    'refrigerator': 'Bulky Waste',
                    'washer': 'Bulky Waste',
                    'dryer': 'Bulky Waste',
                    'oven': 'Bulky Waste',

                    // Sanitary
                    'diaper': 'Sanitary Waste',
                    'sanitary': 'Sanitary Waste',
                    'feminine': 'Sanitary Waste',
                    'tampon': 'Sanitary Waste',
                    'pad': 'Sanitary Waste'
                };

                // Check special categories first
                for (const [term, category] of Object.entries(specialTerms)) {
                    if (itemLower.includes(term)) {
                        return category;
                    }
                }

                // Check hazardous waste
                if (hazardousTerms.some(term => itemLower.includes(term))) {
                    return "Hazardous Waste";
                }

                // Check wet waste
                if (wetWasteTerms.some(term => itemLower.includes(term))) {
                    return "Wet Waste";
                }

                // Check dry waste
                if (dryWasteTerms.some(term => itemLower.includes(term))) {
                    return "Dry Waste";
                }

                // Default to "Not Waste" for unrecognized items to avoid misclassification
                return "Not Waste";
            };

            const wasteType = getWasteType(bestGuess);

            // Create a simple text response
            const resultText = `Object Identified: ${bestGuess}\nWaste Type: ${wasteType}\n\nAll labels found: ${[...new Set(allLabels)].slice(0, 5).join(', ')}`;
            setAnalysisResult(resultText);

            // --- ⬆️ NEW, SMARTER LOGIC ENDS HERE ⬆️ ---

        } catch (err) {
            console.error("Error analyzing image:", err);
            setCameraError(`Analysis failed: ${err.message}. Check your API key and network.`);
        } finally {
            setIsAnalyzing(false);
        }
    };
    // --- End of New Feature Handlers ---

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
            {/* ... (Existing Nav, Hero, Dashboard, Collections sections are unchanged) ... */}

            {/* Navigation Bar */}
            <nav className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md mb-6">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold mr-3">
                            ♻
                        </div>
                        <span className="text-xl font-bold text-gray-800">EcoTrack</span>
                    </div>

                    <div className="flex space-x-4">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-200 flex items-center"
                        >
                            <span className="mr-2">👤</span> Edit Profile
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition duration-200 flex items-center"
                        >
                            <span className="mr-2">🚪</span> Logout
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Welcome Section */}
            <motion.div
                className="bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-2xl shadow-lg p-8 mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex flex-col md:flex-row items-center justify-between">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">
                            Welcome back, {currentUser?.name || "Eco Warrior"}! 🌱
                        </h1>
                        <p className="text-lg opacity-90">
                            Thank you for contributing to a cleaner planet with your sustainable waste management.
                        </p>
                    </div>
                    <motion.div
                        className="mt-4 md:mt-0 bg-white/20 p-4 rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                        <span className="text-4xl">♻</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Dashboard Content */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Wallet Card */}
                <motion.div
                    className="bg-white rounded-2xl shadow-md p-6"
                    variants={itemVariants}
                    whileHover={{ y: -5 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-700 flex items-center">
                            <span className="mr-2">💰</span> Wallet Balance
                        </h2>
                        <div className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                            ECO Credits
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-green-600">₹{walletBalance}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-500">Earn more by recycling properly</p>
                    </div>
                </motion.div>

                {/* QR Code Card */}
                <motion.div
                    className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center justify-center"
                    variants={itemVariants}
                    whileHover={{ y: -5 }}
                >
                    <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">🔍</span> Your QR Code
                    </h2>
                    {qrCodeUrl ? (
                        <motion.div
                            className="p-2 bg-white border border-gray-200 rounded-xl shadow-inner"
                            whileHover={{ scale: 1.05 }}
                        >
                            <img
                                src={qrCodeUrl}
                                alt="QR Code"
                                className="w-40 h-40 object-contain"
                            />
                        </motion.div>
                    ) : (
                        <div className="w-40 h-40 bg-gray-100 rounded-xl flex items-center justify-center">
                            <p className="text-gray-500 text-sm text-center">No QR code available</p>
                        </div>
                    )}
                    <p className="text-sm text-gray-500 mt-4 text-center">
                        Show this QR code to the transporter during waste collection
                    </p>
                </motion.div>
            </motion.div>

            {/* Collections Section */}
            <motion.div
                className="bg-white rounded-2xl shadow-md p-6 mb-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <span className="mr-2">📦</span> Collection History
                    </h2>
                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                        {collections.length} Collections
                    </span>
                </div>

                {collections.length > 0 ? (
                    <div className="space-y-4">
                        {collections.map((c, index) => (
                            <motion.div
                                key={c._id}
                                className="p-5 bg-gray-50 rounded-xl border border-gray-100"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -3 }}
                            >
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3">
                                    <div>
                                        <span className="text-gray-700 font-medium">
                                            Transporter: {c.transporter?.name || "N/A"}
                                        </span>
                                        <span className="mx-2 text-gray-400">•</span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(c.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="mt-2 md:mt-0">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'completed'
                                            ? 'bg-green-100 text-green-800'
                                            : c.status === 'in-progress'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {c.status}
                                        </span>
                                    </div>
                                </div>

                                {c.recycler && (
                                    <div className="text-sm text-gray-600 mb-3">
                                        Recycler:{" "}
                                        <span className="font-medium">
                                            {c.recycler?.name || "Assigned"}
                                        </span>
                                    </div>
                                )}

                                {/* Weight Info */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <p className="text-gray-700 font-semibold mb-2 flex items-center">
                                        <span className="mr-2">⚖️</span> Total Weight: {c.weight} kg
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                        <div className="bg-green-100 px-3 py-2 rounded-lg text-green-800 flex items-center">
                                            <span className="mr-2">💧</span> Wet: {c.wasteTypes?.wet || 0} kg
                                        </div>
                                        <div className="bg-blue-100 px-3 py-2 rounded-lg text-blue-800 flex items-center">
                                            <span className="mr-2">📄</span> Dry: {c.wasteTypes?.dry || 0} kg
                                        </div>
                                        <div className="bg-red-100 px-3 py-2 rounded-lg text-red-800 flex items-center">
                                            <span className="mr-2">⚠️</span> Hazardous: {c.wasteTypes?.hazardous || 0} kg
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <motion.div
                        className="text-center py-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="text-5xl mb-4">📭</div>
                        <h3 className="text-lg font-medium text-gray-700 mb-2">No collections yet</h3>
                        <p className="text-gray-500">Your waste collection history will appear here</p>
                    </motion.div>
                )}
            </motion.div>

            {/* Edit Profile Modal */}
            {isEditing && (
                <motion.div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <motion.div
                        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                                <span className="mr-2">✏️</span> Edit Profile
                            </h2>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="text-gray-500 hover:text-gray-700"
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
                                        <span className="text-gray-400">{field.icon}</span>
                                    </div>
                                    <input
                                        type="text"
                                        name={field.name}
                                        value={profileData[field.name]}
                                        onChange={handleInputChange}
                                        placeholder={field.placeholder}
                                        className="w-full pl-10 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                            ))}

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition flex items-center"
                                >
                                    <span className="mr-2">💾</span> Save Changes
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}

            {/* --- NEW: Hidden Canvas for Image Capture --- */}
            <canvas ref={canvasRef} className="hidden"></canvas>

            {/* --- NEW: Camera Scan FAB (Floating Action Button) --- */}
            <motion.button
                onClick={handleOpenCamera}
                className="fixed bottom-6 right-6 bg-green-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-green-700 transition"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="Scan Waste"
            >
                <span className="text-3xl">📷</span>
            </motion.button>

            {/* --- NEW: Camera Modal --- */}
            {isCameraOpen && (
                <motion.div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <motion.div
                        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                                <span className="mr-2">♻️</span> Waste Scanner
                            </h2>
                            <button
                                onClick={handleCloseCamera}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Video/Image Display Area */}
                        <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4 shadow-inner">
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

                        {/* Action Buttons */}
                        <div className="flex justify-center gap-4 mb-4">
                            {!capturedImage ? (
                                <button
                                    onClick={handleCaptureImage}
                                    disabled={!!cameraError || !stream}
                                    className="w-20 h-20 bg-white border-4 border-green-600 rounded-full flex items-center justify-center text-3xl shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:border-gray-500"
                                    title="Capture Photo"
                                >
                                    <span className="w-16 h-16 bg-green-600 rounded-full"></span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleRetakeImage}
                                        disabled={isAnalyzing}
                                        className="px-5 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50"
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

                        {/* Analysis Result or Error */}
                        <div className="mt-4 min-h-[6rem]">
                            {isAnalyzing && (
                                <div className="text-center text-gray-600">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                                    <p className="mt-2 font-medium">AI is thinking...</p>
                                </div>
                            )}

                            {cameraError && !isAnalyzing && (
                                <div className="bg-red-100 border border-red-300 text-red-800 rounded-lg p-3 text-center">
                                    {cameraError}
                                </div>
                            )}

                            {analysisResult && !isAnalyzing && (
                                <motion.div
                                    className="bg-green-50 rounded-lg p-4 border border-green-200"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <h3 className="font-bold text-lg text-green-700 mb-2">Analysis Result</h3>
                                    {/* Using whitespace-pre-line to respect newlines from the AI */}
                                    <p className="text-gray-800 whitespace-pre-line">{analysisResult}</p>
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