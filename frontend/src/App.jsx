import { useState, useEffect, useRef } from 'react';
import './App.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

const pickupIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
const cabIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854894.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
const dropIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/252/252025.png', // blue pin for drop
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
const carIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/744/744465.png', // car icon
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function App() {
  const [phone, setPhone] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingIdx, setPlayingIdx] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [fare, setFare] = useState(null);
  const [cabLoc, setCabLoc] = useState(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const chatEndRef = useRef(null);
  const [otp, setOtp] = useState(null);
  const [awaitingCabDetails, setAwaitingCabDetails] = useState(false);
  const [cabDetailsShown, setCabDetailsShown] = useState(false);
  const [cabDetails, setCabDetails] = useState({
    driver: 'Ravi Kumar',
    cabNumber: 'KA05AB1234',
    model: 'Maruti Suzuki Dzire',
    color: 'White'
  });
  const [awaitingPaymentMethod, setAwaitingPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [awaitingCabDetailsAfterPay, setAwaitingCabDetailsAfterPay] = useState(false);
  const [cabDetailsAfterPayShown, setCabDetailsAfterPayShown] = useState(false);
  const [showPayNow, setShowPayNow] = useState(false);
  const [awaitingQRScan, setAwaitingQRScan] = useState(false);

  // Voice input state
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef(null);

  // Scroll to bottom on new chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat]);

  // AI welcome message with OTP after login
  useEffect(() => {
    if (isLoggedIn && chat.length === 0) {
      const generatedOtp = Math.floor(1000 + Math.random() * 9000);
      setOtp(generatedOtp);
      sendAIWelcome(generatedOtp);
    }
    // eslint-disable-next-line
  }, [isLoggedIn]);

  const sendAIWelcome = (otpVal) => {
    const WELCOME_MESSAGES = {
      en: `Hello, please enter your destination.\nOTP: ${otpVal}`,
      hi: `नमस्ते, कृपया अपना गंतव्य दर्ज करें।\nOTP: ${otpVal}`,
      kn: `ಹಲೋ, ದಯವಿಟ್ಟು ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ನಮೂದಿಸಿ.\nOTP: ${otpVal}`
    };
    setChat([{ from: 'bot', text: WELCOME_MESSAGES['en'], tts: true }]);
  };

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            reject('Location access denied');
          }
        );
      }
    });
  };

  // Haversine formula to calculate distance between two lat/lng points in km
  function haversine(lat1, lon1, lat2, lon2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Geocode destination using Nominatim, restricted to Bangalore
  async function geocodeDestination(dest) {
    // Viewbox: [minLon, minLat, maxLon, maxLat] for Bangalore
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=IN&viewbox=77.45,12.8,77.7,13.1&bounded=1&q=${encodeURIComponent(dest)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  }

  // Reverse geocode pickup location
  async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    const data = await res.json();
    return data && data.display_name ? data.display_name : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // Random cab details
  const CAB_DRIVERS = [
    { driver: 'Ravi Kumar', cabNumber: 'KA05AB1234', model: 'Maruti Suzuki Dzire' },
    { driver: 'Sunil Shetty', cabNumber: 'KA03CD5678', model: 'Hyundai i20' },
    { driver: 'Priya Singh', cabNumber: 'KA01EF9012', model: 'Toyota Etios' },
    { driver: 'Amit Verma', cabNumber: 'KA02GH3456', model: 'Honda Amaze' },
    { driver: 'Suresh Raina', cabNumber: 'KA04IJ7890', model: 'Tata Indigo' }
  ];

  // Simulate moving cab
  const [cabAnimLoc, setCabAnimLoc] = useState(null);
  const cabAnimInterval = useRef(null);

  useEffect(() => {
    if (bookingDone && pickup && pickup.lat && pickup.lng && chat.find(m => m.from === 'map')?.dropLoc) {
      // Start cab at 30% between drop and pickup
      const dropLoc = chat.find(m => m.from === 'map').dropLoc;
      let t = 0.3;
      function interpolate(a, b, t) { return a + (b - a) * t; }
      setCabAnimLoc({
        lat: interpolate(pickup.lat, dropLoc.lat, t),
        lng: interpolate(pickup.lng, dropLoc.lng, t)
      });
      if (cabAnimInterval.current) clearInterval(cabAnimInterval.current);
      cabAnimInterval.current = setInterval(() => {
        t += 0.07; // move closer each second
        if (t >= 1) {
          t = 1;
          clearInterval(cabAnimInterval.current);
        }
        setCabAnimLoc({
          lat: interpolate(pickup.lat, dropLoc.lat, t),
          lng: interpolate(pickup.lng, dropLoc.lng, t)
        });
      }, 1000);
      return () => clearInterval(cabAnimInterval.current);
    }
  }, [bookingDone, pickup, chat]);

  // After booking, immediately ask for payment method
  useEffect(() => {
    if (bookingDone && !awaitingPaymentMethod && !paymentMethod && !rideCompleted) {
      setTimeout(() => {
        setChat(prev => [...prev, { from: 'bot', text: 'How would you like to make your payment? (UPI or Cash)', tts: true }]);
        setAwaitingPaymentMethod(true);
      }, 500);
    }
  }, [bookingDone, awaitingPaymentMethod, paymentMethod, rideCompleted]);

  const handleSend = async (e, userMsg) => {
    if (e) e.preventDefault();
    const msg = userMsg !== undefined ? userMsg : message;
    if (msg.trim().length === 0) return;
    setChat((prev) => [...prev, { from: 'user', text: msg }]);
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (awaitingPaymentMethod && !paymentMethod && !rideCompleted) {
        // Only accept UPI or Cash
        if (/^upi$/i.test(msg.trim())) {
          setPaymentMethod('UPI');
          setAwaitingPaymentMethod(false);
          setShowPayNow(true);
        } else if (/^cash$/i.test(msg.trim())) {
          setPaymentMethod('Cash');
          setAwaitingPaymentMethod(false);
          setTimeout(() => {
            setChat(prev => [...prev, { from: 'bot', text: 'Please pay the driver in cash. Thank you! Enjoy your ride. Would you like to see your cab details (driver name, cab number)?', tts: true }]);
            setRideCompleted(true);
            setAwaitingCabDetailsAfterPay(true);
          }, 500);
        } else {
          setChat(prev => [...prev, { from: 'bot', text: "Please reply with 'UPI' or 'Cash'.", tts: true }]);
        }
        setLoading(false);
        return;
      }
      if (showPayNow && paymentMethod === 'UPI' && !rideCompleted) {
        // Only proceed if user clicks Pay Now (handled in button)
        setLoading(false);
        return;
      }
      if (awaitingQRScan) {
        if (/^scanned$/i.test(msg.trim())) {
          setAwaitingQRScan(false);
          setTimeout(() => {
            setChat(prev => [...prev, { from: 'bot', text: 'Payment successful! Thank you! Enjoy your ride. Would you like to see your cab details (driver name, cab number)?', tts: true }]);
            setAwaitingCabDetailsAfterPay(true);
            setRideCompleted(true);
          }, 500);
        } else {
          setChat(prev => [...prev, { from: 'bot', text: "Please type 'scanned' after you have scanned the QR code.", tts: true }]);
        }
        setLoading(false);
        return;
      }
      if (awaitingCabDetailsAfterPay && !cabDetailsAfterPayShown) {
        if (/^yes$/i.test(msg.trim())) {
          setChat(prev => [...prev, {
            from: 'bot',
            text: `Cab Details:\nDriver: ${cabDetails.driver}\nCab Number: ${cabDetails.cabNumber}\nModel: ${cabDetails.model}`,
            tts: true
          }]);
          setCabDetailsAfterPayShown(true);
          setAwaitingCabDetailsAfterPay(false);
          setShowShare(true);
        } else if (/^no$/i.test(msg.trim())) {
          setCabDetailsAfterPayShown(true);
          setAwaitingCabDetailsAfterPay(false);
          setShowShare(true);
        } else {
          setChat(prev => [...prev, { from: 'bot', text: "Please reply with 'yes' or 'no'.", tts: true }]);
        }
        setLoading(false);
        return;
      }
      if (!bookingDone) {
        // Get user location
        let userLoc = null;
        let pickupDisplayName = null;
        try {
          userLoc = await getLocation();
          pickupDisplayName = userLoc ? await reverseGeocode(userLoc.lat, userLoc.lng) : null;
          setPickup({ ...userLoc, display_name: pickupDisplayName });
        } catch (locErr) {
          setPickup('Location not available');
        }
        // Geocode destination
        let destLoc = null;
        try {
          destLoc = await geocodeDestination(msg);
        } catch (geoErr) {
          destLoc = null;
        }
        // Calculate distance and fare
        let distance = null;
        let fare = null;
        if (userLoc && destLoc) {
          distance = haversine(userLoc.lat, userLoc.lng, destLoc.lat, destLoc.lng);
          fare = 50 + Math.round(distance * 20); // ₹50 base + ₹20/km
        } else {
          fare = 100 + Math.floor(Math.random() * 200); // fallback
        }
        setFare(fare);
        setCabLoc(userLoc && userLoc.lat && userLoc.lng ? { lat: userLoc.lat + 0.002, lng: userLoc.lng + 0.002 } : null);
        const res = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: phone, message: msg, language: 'en' })
        });
        const data = await res.json();
        setChat((prev) => [
          ...prev,
          { from: 'bot', text: data.response, tts: true },
          { from: 'map', pickup: { ...userLoc, display_name: pickupDisplayName }, drop: msg, dropLoc: destLoc, fare, cabLoc: userLoc && userLoc.lat && userLoc.lng ? { lat: userLoc.lat + 0.002, lng: userLoc.lng + 0.002 } : null, distance }
        ]);
        setBookingDone(true);
      } else if (awaitingCabDetails && !cabDetailsShown) {
        // Only accept 'yes' or 'no'
        if (/^yes$/i.test(msg.trim())) {
          setChat(prev => [...prev, {
            from: 'bot',
            text: `Cab Details:\nDriver: ${cabDetails.driver}\nCab Number: ${cabDetails.cabNumber}\nModel: ${cabDetails.model}`,
            tts: true
          }]);
          setCabDetailsShown(true);
          setAwaitingCabDetails(false);
        } else if (/^no$/i.test(msg.trim())) {
          setCabDetailsShown(true);
          setAwaitingCabDetails(false);
        } else {
          setChat(prev => [...prev, { from: 'bot', text: "Please reply with 'yes' or 'no'.", tts: true }]);
        }
      } else {
        setChat((prev) => [...prev, { from: 'bot', text: 'Thank you! If you want to book another cab, click Back.', tts: true }]);
      }
    } catch (err) {
      setChat((prev) => [...prev, { from: 'bot', text: 'Server error', tts: false }]);
    }
    setLoading(false);
  };

  // Remove dash and extra spaces before destination for TTS
  const cleanTTS = (text) => {
    return text.replace(/\s*-\s*/, ' ');
  };

  const handlePlayTTS = async (text, idx) => {
    setPlayingIdx(idx);
    try {
      const ttsText = cleanTTS(text);
      const res = await fetch('http://localhost:8000/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, language: 'en' })
      });
      const data = await res.json();
      if (data.audio_url) {
        const audio = new Audio('http://localhost:8000' + data.audio_url);
        audio.play();
        audio.onended = () => setPlayingIdx(null);
      } else {
        setError('TTS error');
        setPlayingIdx(null);
      }
    } catch (err) {
      setError('TTS error');
      setPlayingIdx(null);
    }
  };

  // Voice input (Web Speech API)
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setError('Voice input not supported in this browser.');
      return;
    }
    if (recognizing) {
      recognitionRef.current.stop();
      setRecognizing(false);
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMessage(transcript);
      setRecognizing(false);
      handleSend(null, transcript);
    };
    recognition.onerror = () => {
      setRecognizing(false);
      setError('Voice input error.');
    };
    recognition.onend = () => setRecognizing(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecognizing(true);
  };

  const handleBack = () => {
    setIsLoggedIn(false);
    setChat([]);
    setMessage('');
    setError('');
    setPlayingIdx(null);
    setPickup(null);
    setFare(null);
    setCabLoc(null);
    setBookingDone(false);
    setPaymentDone(false);
    setRideCompleted(false);
    setShowShare(false);
    setShareMsg('');
  };

  // Phone number validation
  const isValidPhone = (num) => /^\d{10}$/.test(num);

  // Share ride details
  const handleShareRide = () => {
    setShowShareOptions(true);
  };

  const handleCancelShare = () => {
    setShowShareOptions(false);
    setTimeout(() => {
      setChat(prev => [...prev, { from: 'bot', text: 'Thank you for riding with us! If you want to book another cab, just enter your new destination.', tts: true }]);
      setShowShare(false);
      setChatEnded(true);
    }, 300);
  };

  const getShareMessage = () => {
    const mapMsg = chat.find(m => m.from === 'map');
    const pickupDisplayName = mapMsg && mapMsg.pickup && typeof mapMsg.pickup !== 'string' ? mapMsg.pickup.display_name : null;
    const destination = mapMsg && mapMsg.dropLoc && typeof mapMsg.dropLoc !== 'string' ? mapMsg.dropLoc.display_name : null;
    return `I am taking a cab ride!\nPickup: ${pickupDisplayName || 'Unknown'}\nDrop: ${destination || 'Unknown'}\nDriver: ${cabDetails.driver}\nCab Number: ${cabDetails.cabNumber}\nModel: ${cabDetails.model}\nFare: ₹${fare}`;
  };

  const handleWhatsAppShare = () => {
    const msg = encodeURIComponent(getShareMessage());
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    setShowShareOptions(false);
    setTimeout(() => {
      setChat(prev => [...prev, { from: 'bot', text: 'Thank you for riding with us! If you want to book another cab, just enter your new destination.', tts: true }]);
      setShowShare(false);
      setChatEnded(true);
    }, 300);
  };

  const handleSMSShare = () => {
    const msg = encodeURIComponent(getShareMessage());
    window.open(`sms:?body=${msg}`, '_blank');
    setShowShareOptions(false);
    setTimeout(() => {
      setChat(prev => [...prev, { from: 'bot', text: 'Thank you for riding with us! If you want to book another cab, just enter your new destination.', tts: true }]);
      setShowShare(false);
      setChatEnded(true);
    }, 300);
  };

  // Add a state to control if chat is ended
  const [chatEnded, setChatEnded] = useState(false);

  // Customer support modal state
  const [showSupport, setShowSupport] = useState(false);

  // Live chat state for support modal
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [liveChatMsgs, setLiveChatMsgs] = useState([
    { from: 'support', text: 'Hi! How can we help you today?' }
  ]);
  const [liveChatInput, setLiveChatInput] = useState('');

  const handleLiveChatSend = (e) => {
    e.preventDefault();
    if (!liveChatInput.trim()) return;
    const userMsg = liveChatInput.trim().toLowerCase();
    setLiveChatMsgs(msgs => [
      ...msgs,
      { from: 'user', text: liveChatInput }
    ]);
    setLiveChatInput('');
    setTimeout(() => {
      let reply = '';
      if (userMsg.includes('not arrived') || userMsg.includes('late') || userMsg.includes('cab hasn') || userMsg.includes('cab did not') || userMsg.includes('waiting')) {
        reply = "We’re sorry your cab hasn’t arrived yet. Please wait a few more minutes or call our support line for urgent help.";
      } else if (userMsg.includes('cancel')) {
        reply = "To cancel your ride, please use the app’s cancel option or let us know your booking details.";
      } else if (userMsg.includes('driver')) {
        reply = "If you’re facing issues with your driver, please share more details so we can assist you.";
      } else if (userMsg.includes('payment') || userMsg.includes('pay') || userMsg.includes('upi') || userMsg.includes('cash')) {
        reply = "For payment issues, please specify if it’s UPI or cash and describe the problem.";
      } else if (userMsg.includes('thank')) {
        reply = "You’re welcome! We’re here if you need anything else.";
      } else if (userMsg.includes('hello') || userMsg.includes('hi')) {
        reply = "Hello! How can we assist you today?";
      } else {
        reply = "Thank you for reaching out! Our support team will contact you soon.";
      }
      setLiveChatMsgs(msgs => [
        ...msgs,
        { from: 'support', text: reply }
      ]);
    }, 900);
  };

  // When opening support modal, reset live chat state
  const openSupportModal = () => {
    setShowSupport(true);
    setShowLiveChat(false);
    setLiveChatInput('');
    setLiveChatMsgs([{ from: 'support', text: 'Hi! How can we help you today?' }]);
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-logo"><span role="img" aria-label="cab">🚕</span> Cabwise</div>
        <h2>Login</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (!isValidPhone(phone)) {
            setError('Please enter a valid 10-digit phone number.');
            return;
          }
          setLoading(true);
          try {
            const res = await fetch('http://localhost:8000/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone_number: phone, language: 'en' })
            });
            if (res.ok) {
              setIsLoggedIn(true);
            } else {
              const data = await res.json();
              setError(data.message || 'Login failed');
            }
          } catch (err) {
            setError('Server error');
          }
          setLoading(false);
        }}>
          <input
            type="tel"
            placeholder="Enter phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            disabled={loading}
            maxLength={10}
          />
          <button type="submit" disabled={loading}>Login</button>
        </form>
        {error && <div className="error-msg">{error}</div>}
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="app-header">
        <span role="img" aria-label="cab">🚕</span> Cabwise
      </div>
      <div className="chat-box" style={{ minHeight: 300 }}>
        {chat.map((msg, idx) => (
          <div key={idx} className={msg.from === 'user' ? 'user-msg' : msg.from === 'bot' ? 'bot-msg' : msg.from === 'map' ? 'map-msg' : 'pay-msg'} style={{ marginBottom: 12 }}>
            {msg.from === 'map' ? (
              msg.pickup && typeof msg.pickup !== 'string' && msg.dropLoc ? (
                <>
                  <div style={{ margin: '8px 0', width: '100%', maxWidth: 400, height: 250 }}>
                    <MapContainer center={[msg.pickup.lat, msg.pickup.lng]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {/* Pickup marker */}
                      <Marker position={[msg.pickup.lat, msg.pickup.lng]} icon={pickupIcon}>
                        <Popup>Your pickup location</Popup>
                      </Marker>
                      {/* Drop marker */}
                      {msg.dropLoc && (
                        <Marker position={[msg.dropLoc.lat, msg.dropLoc.lng]} icon={dropIcon}>
                          <Popup>Your destination</Popup>
                        </Marker>
                      )}
                      {/* Route polyline */}
                      {msg.dropLoc && (
                        <Polyline positions={[[msg.pickup.lat, msg.pickup.lng], [msg.dropLoc.lat, msg.dropLoc.lng]]} color="blue" />
                      )}
                      {/* Cab marker (car icon, moving toward pickup) */}
                      {msg.pickup && msg.dropLoc && cabAnimLoc && (
                        <Marker
                          position={[cabAnimLoc.lat, cabAnimLoc.lng]}
                          icon={carIcon}
                        >
                          <Popup>
      <div>
                              <b>Driver is here</b><br />
                              {(() => {
                                // Calculate distance and ETA from cab to pickup
                                const toRad = x => x * Math.PI / 180;
                                const R = 6371;
                                const dLat = toRad(msg.pickup.lat - cabAnimLoc.lat);
                                const dLon = toRad(msg.pickup.lng - cabAnimLoc.lng);
                                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                  Math.cos(toRad(cabAnimLoc.lat)) * Math.cos(toRad(msg.pickup.lat)) *
                                  Math.sin(dLon/2) * Math.sin(dLon/2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                const dist = R * c;
                                const eta = dist / 30 * 60; // 30 km/h average speed, ETA in minutes
                                return (
                                  <>
                                    Distance: {dist.toFixed(2)} km<br />
                                    ETA: {Math.max(1, Math.round(eta))} min
                                  </>
                                );
                              })()}
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>
                  <div className="booking-confirmation" style={{ marginTop: 8, textAlign: 'left' }}>
                    <div><b>Pickup:</b> {msg.pickup ? (typeof msg.pickup === 'string' ? msg.pickup : (msg.pickup.display_name ? msg.pickup.display_name.split(',').slice(0,2).join(', ') : `${msg.pickup.lat.toFixed(4)}, ${msg.pickup.lng.toFixed(4)}`)) : 'Detecting...'}</div>
                    <div><b>Drop:</b> {msg.dropLoc && msg.dropLoc.display_name ? msg.dropLoc.display_name.split(',').slice(0,2).join(', ') : msg.drop}</div>
                    <div><b>Distance:</b> {msg.distance ? msg.distance.toFixed(2) + ' km' : 'N/A'}</div>
                    <div><b>Estimated Fare:</b> ₹{msg.fare}</div>
                  </div>
                  {/* Pay Now button is shown only after cab details step is complete */}
                  {/* (see below for placement) */}
                </>
              ) : (
                <div>Location not available</div>
              )
            ) : msg.from === 'pay' ? (
              <div style={{ color: 'green', fontWeight: 'bold' }}>{msg.text}</div>
            ) : (
              <>
                {msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                {msg.tts && (
                  <button
                    className="tts-btn"
                    onClick={() => handlePlayTTS(msg.text, idx)}
                    disabled={playingIdx === idx}
                    style={{ marginLeft: 8 }}
                    title="Play voice message"
                  >
                    {playingIdx === idx ? '🔊...' : '🔊'}
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {/* Show Pay Now button for UPI after user selects UPI */}
        {showPayNow && paymentMethod === 'UPI' && !rideCompleted && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="pay-btn" onClick={() => {
              setShowPayNow(false);
              setAwaitingQRScan(true);
              setTimeout(() => {
                setChat(prev => [...prev, { from: 'bot', text: 'Please scan the QR code below to pay via UPI.', tts: true }]);
              }, 300);
            }}>Pay Now</button>
          </div>
        )}
        {/* Show QR code for UPI after Pay Now is clicked and awaiting QR scan */}
        {awaitingQRScan && paymentMethod === 'UPI' && !rideCompleted && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=demo@upi&pn=Demo%20Cab%20Service&am=100" alt="UPI QR" style={{ borderRadius: 12, marginBottom: 8 }} />
            <div style={{ color: '#fff', fontWeight: 500 }}>Scan to pay via UPI</div>
            <div style={{ color: '#fff', fontSize: '0.95rem', marginTop: 4 }}>UPI ID: demo@upi</div>
          </div>
        )}
        {/* Show Share Ride button after cab details step is complete */}
        {showShare && !chatEnded && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button className="pay-btn" style={{ background: '#1976d2' }} onClick={handleShareRide}>Share Ride</button>
            {showShareOptions && (
              <div className="share-modal-overlay" onClick={handleCancelShare}>
                <div className="share-modal" onClick={e => e.stopPropagation()}>
                  <button className="pay-btn" style={{ background: '#25D366' }} onClick={handleWhatsAppShare}>Share via WhatsApp</button>
                  <button className="pay-btn" style={{ background: '#1976d2' }} onClick={handleSMSShare}>Share via SMS</button>
                  <button className="cancel-btn" onClick={handleCancelShare}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {loading && <div className="bot-msg">...</div>}
        <div ref={chatEndRef} />
      </div>
      {/* Chat input and send button */}
      {!chatEnded && (
        <form className="input-form" onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
          <input
            type="text"
            placeholder="Type your reply or use voice..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={loading || recognizing}
            style={{ flex: 1, marginRight: 8 }}
          />
          <button type="submit" className="send-btn" disabled={loading || recognizing || !message.trim()}>Send</button>
          <button type="button" className="mic-btn" onClick={handleVoiceInput} disabled={recognizing || loading} title="Voice input">🎤</button>
        </form>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 12 }}>
        <button className="back-btn" onClick={handleBack} style={{ padding: '4px 10px', fontSize: '0.85rem' }}>&larr; Back</button>
      </div>
      {error && <div className="error-msg">{error}</div>}

      {/* Floating Customer Support Button */}
      <button className="support-btn" title="Customer Support" onClick={openSupportModal}>
        <span role="img" aria-label="support">🎧</span>
      </button>
      {/* Customer Support Modal */}
      {showSupport && (
        <div className="support-modal-overlay" onClick={() => setShowSupport(false)}>
          <div className="support-modal" onClick={e => e.stopPropagation()}>
            <button className="close-x" onClick={() => setShowSupport(false)} title="Close">×</button>
            <div className="support-title"><span role="img" aria-label="support">🎧</span> Customer Support</div>
            <div className="support-divider" />
            <div className="support-message">We're here to help! Contact us if your cab hasn't arrived or for any other issue.</div>
            <div className="support-contact">
              <a href="tel:18001234567" className="support-link">📞 1800-123-4567</a>
              <a href="mailto:support@cabservice.com" className="support-link">✉️ support@cabservice.com</a>
            </div>
            {!showLiveChat && (
              <button className="pay-btn" style={{ width: 180, marginTop: 6 }} onClick={() => setShowLiveChat(true)}>💬 Live Chat</button>
            )}
            {showLiveChat && (
              <div style={{ width: '100%' }}>
                <div className="support-livechat">
                  <div className="support-livechat-msg">
                    {liveChatMsgs.map((msg, idx) => (
                      <div key={idx} className={`support-livechat-bubble ${msg.from}`}>{msg.text}</div>
                    ))}
                  </div>
                </div>
                <form className="support-livechat-input" onSubmit={handleLiveChatSend}>
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={liveChatInput}
                    onChange={e => setLiveChatInput(e.target.value)}
                  />
                  <button type="submit" disabled={!liveChatInput.trim()}>Send</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
