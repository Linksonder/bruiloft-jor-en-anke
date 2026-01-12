// GeoGuesser Game with Real Map
let map;
let currentRound = 0;
let totalScore = 0;
let roundResults = [];
let hasGuessed = false;
let guessMarker = null;
let answerMarker = null;
let questions = []; // Will be loaded from locations.json

// Supabase Configuration
const SUPABASE_URL = 'https://rkdlhwkihbdclxrpxmoa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGxod2tpaGJkY2x4cnB4bW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzI4MzMsImV4cCI6MjA4Mjk0ODgzM30.9TeWzRerZ2Mnqkcr1DSJjSJNfjC14xCr05ChYeNE3T8';
var supabase;

// Load locations from JSON file
async function loadLocations() {
    try {
        const response = await fetch('locations.json');
        const locations = await response.json();
        questions = locations.map(loc => ({
            image: loc.image,
            text: loc.location,
            answer: { lat: loc.coordinates[0], lng: loc.coordinates[1] },
            location: loc.hint
        }));
        return true;
    } catch (error) {
        console.error('Error loading locations:', error);
        return false;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase client
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Load main leaderboard on page load
    loadMainLeaderboard();
    
    // Preload game images in the background
    preloadGameImages();
    
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('next-button').addEventListener('click', nextRound);
    document.getElementById('restart-game-btn').addEventListener('click', resetGame);
    document.getElementById('close-game-modal').addEventListener('click', closeModal);
    document.getElementById('close-end-game-btn').addEventListener('click', closeModal);
    document.getElementById('save-score-btn').addEventListener('click', saveScore);
    
    // Close modal when clicking outside
    document.getElementById('game-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
});

// Preload all game images for faster loading
async function preloadGameImages() {
    try {
        const response = await fetch('locations.json');
        const locations = await response.json();
        locations.forEach(loc => {
            if (loc.image) {
                const img = new Image();
                img.src = loc.image;
            }
        });
    } catch (error) {
        console.log('Preloading images failed:', error);
    }
}

async function startGame() {
    // Load locations from JSON first
    const loaded = await loadLocations();
    if (!loaded || questions.length === 0) {
        alert('Kon de locaties niet laden. Probeer het later opnieuw.');
        return;
    }
    
    currentRound = 0;
    totalScore = 0;
    roundResults = [];
    
    // Open modal
    document.getElementById('game-modal').classList.add('active');
    document.getElementById('game-play-modal').style.display = 'block';
    document.getElementById('game-end-modal').style.display = 'none';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Initialize Leaflet map (with delay to ensure container is visible)
    setTimeout(function() {
        if (!map) {
            map = L.map('map', {
                center: [52.1326, 5.2913], // Netherlands center
                zoom: 7,
                zoomControl: true,
                tap: true, // Enable tap for mobile
                touchZoom: true,
                dragging: true
            });
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Handle window resize for mobile orientation changes
            window.addEventListener('resize', function() {
                if (map) {
                    setTimeout(function() {
                        map.invalidateSize();
                    }, 100);
                }
            });
        } else {
            map.invalidateSize(); // Refresh map size
        }
        
        // Extra invalidateSize for mobile
        setTimeout(function() {
            if (map) map.invalidateSize();
        }, 300);
        
        loadRound();
    }, 100);
}

function loadRound() {
    if (currentRound >= questions.length) {
        endGame();
        return;
    }
    
    hasGuessed = false;
    const question = questions[currentRound];
    
    // Update UI
    document.getElementById('current-round').textContent = currentRound + 1;
    document.getElementById('total-rounds').textContent = questions.length;
    document.getElementById('question-text').textContent = question.text;
    document.getElementById('question-image').src = question.image;
    document.getElementById('feedback').innerHTML = '';
    document.getElementById('next-button').style.display = 'none';
    
    // Remove previous markers
    if (guessMarker) {
        map.removeLayer(guessMarker);
        guessMarker = null;
    }
    if (answerMarker) {
        map.removeLayer(answerMarker);
        answerMarker = null;
    }
    
    // Reset map view
    map.setView([52.1326, 5.2913], 7);
    
    // Enable map clicking
    map.off('click');
    map.on('click', handleMapClick);
    map.getContainer().style.cursor = 'crosshair';
}

function handleMapClick(e) {
    if (hasGuessed) return;
    
    const clickedLat = e.latlng.lat;
    const clickedLng = e.latlng.lng;
    
    makeGuess(clickedLat, clickedLng);
}

function makeGuess(lat, lng) {
    hasGuessed = true;
    const question = questions[currentRound];
    
    // Add guess marker (blue)
    guessMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'guess-marker',
            html: '<div style="background-color: #3388ff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(map);
    
    // Add answer marker (olive green)
    answerMarker = L.marker([question.answer.lat, question.answer.lng], {
        icon: L.divIcon({
            className: 'answer-marker',
            html: '<div style="background-color: #617320; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(map);
    
    // Draw line between guess and answer
    const line = L.polyline(
        [[lat, lng], [question.answer.lat, question.answer.lng]],
        { color: '#8C0327', weight: 2, dashArray: '5, 10' }
    ).addTo(map);
    
    // Calculate distance in kilometers
    const distance = map.distance([lat, lng], [question.answer.lat, question.answer.lng]) / 1000;
    const distanceKm = Math.round(distance);
    
    // Calculate score (exponential decay based on distance)
    // Perfect: 100 points, 1000km: ~0 points
    let score = Math.max(0, Math.round(100 * Math.exp(-distance / 200)));
    totalScore += score;
    
    // Fit map to show both markers
    map.fitBounds([
        [lat, lng],
        [question.answer.lat, question.answer.lng]
    ], { padding: [50, 50] });
    
    // Show feedback
    const feedback = document.getElementById('feedback');
    
    if (distanceKm < 10) {
        feedback.innerHTML = `🎯 <strong>Perfect!</strong> Je zat slechts ${distanceKm}km ernaast!<br><span style="color: #617320; font-size: 24px;">+${score} punten</span>`;
    } else if (distanceKm < 50) {
        feedback.innerHTML = `👍 <strong>Uitstekend!</strong> Je zat ${distanceKm}km ernaast!<br><span style="color: #617320; font-size: 24px;">+${score} punten</span>`;
    } else if (distanceKm < 150) {
        feedback.innerHTML = `👌 <strong>Goed gedaan!</strong> Je zat ${distanceKm}km ernaast!<br><span style="color: #F29F05; font-size: 24px;">+${score} punten</span>`;
    } else if (distanceKm < 300) {
        feedback.innerHTML = `🤔 <strong>Niet slecht!</strong> Je zat ${distanceKm}km ernaast!<br><span style="color: #F29F05; font-size: 24px;">+${score} punten</span>`;
    } else {
        feedback.innerHTML = `📍 Het was <strong>${question.location}</strong>! Je zat ${distanceKm}km ernaast.<br><span style="color: #8C0327; font-size: 24px;">+${score} punten</span>`;
    }
    
    roundResults.push({
        round: currentRound + 1,
        location: question.location,
        score: score,
        distance: distanceKm
    });
    
    // Disable map clicking and show next button
    map.off('click');
    map.getContainer().style.cursor = 'default';
    document.getElementById('next-button').style.display = 'inline-block';
}

function nextRound() {
    currentRound++;
    loadRound();
}

function endGame() {
    document.getElementById('game-play-modal').style.display = 'none';
    document.getElementById('game-end-modal').style.display = 'block';
    document.getElementById('final-score').textContent = totalScore;
    
    // Score message
    const message = document.getElementById('score-message');
    if (totalScore >= 270) {
        message.innerHTML = '🏆 <strong>Ongelooflijk!</strong> Ben jij een GPS?!';
        message.style.color = '#617320';
    } else if (totalScore >= 200) {
        message.innerHTML = '⭐ <strong>Super gedaan!</strong> Je hebt talent!';
        message.style.color = '#617320';
    } else if (totalScore >= 120) {
        message.innerHTML = '👏 <strong>Goed bezig!</strong> Niet slecht!';
        message.style.color = '#F29F05';
    } else {
        message.innerHTML = '😄 <strong>Gezellig gespeeld!</strong> Probeer nog eens!';
        message.style.color = '#F29F05';
    }
    
    // Round details
    const detailsDiv = document.getElementById('round-details');
    detailsDiv.innerHTML = '<h4 style="margin-bottom: 15px;">Je resultaten:</h4>';
    roundResults.forEach(result => {
        detailsDiv.innerHTML += `
            <div style="padding: 12px; background: #f8f8f8; margin: 8px 0; border-radius: 5px; border-left: 4px solid #8C0327;">
                <strong>Ronde ${result.round}:</strong> ${result.location}<br>
                <span style="color: #666;">📍 ${result.distance} km afstand | ⭐ ${result.score} punten</span>
            </div>
        `;
    });
    
    // Load leaderboard
    loadLeaderboard();
}

async function saveScore() {
    const playerName = document.getElementById('player-name').value.trim();
    const feedback = document.getElementById('save-feedback');
    
    if (!playerName) {
        feedback.innerHTML = '<span style="color: #8C0327;">❌ Vul je naam in!</span>';
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .insert([
                { name: playerName, score: totalScore }
            ]);
        
        if (error) throw error;
        
        feedback.innerHTML = '<span style="color: #617320;">✅ Opgeslagen!</span>';
        document.getElementById('save-score-btn').disabled = true;
        document.getElementById('player-name').disabled = true;
        
        // Reload leaderboard
        setTimeout(() => {
            loadLeaderboard();
            loadMainLeaderboard();
        }, 500);
        
    } catch (error) {
        console.error('Error saving score:', error);
        feedback.innerHTML = '<span style="color: #8C0327;">❌ Er ging iets mis. Probeer opnieuw.</span>';
    }
}

async function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard-list');
    
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            leaderboardDiv.innerHTML = '';
            data.forEach((entry, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                const isCurrentUser = entry.score === totalScore && entry.name === document.getElementById('player-name').value.trim();
                const highlight = isCurrentUser ? 'background: #fff3cd; border-left: 4px solid #8C0327;' : 'background: #f8f8f8;';
                
                leaderboardDiv.innerHTML += `
                    <div style="padding: 12px; ${highlight} margin: 8px 0; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>${medal}</strong> ${entry.name}</span>
                        <span style="color: #8C0327; font-weight: bold;">${entry.score} punten</span>
                    </div>
                `;
            });
        } else {
            leaderboardDiv.innerHTML = '<p style="text-align: center; color: #999;">Nog geen scores. Wees de eerste!</p>';
        }
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardDiv.innerHTML = '<p style="text-align: center; color: #8C0327;">Kon leaderboard niet laden.</p>';
    }
}

async function loadMainLeaderboard() {
    const leaderboardDiv = document.getElementById('main-leaderboard-list');
    
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            leaderboardDiv.innerHTML = '';
            data.forEach((entry, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `<strong>${index + 1}.</strong>`;
                
                leaderboardDiv.innerHTML += `
                    <div style="padding: 15px; background: ${index < 3 ? '#fff9e6' : '#f8f8f8'}; margin: 10px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${index < 3 ? '#8C0327' : '#ddd'};">
                        <span style="font-size: 18px;">${medal} <strong>${entry.name}</strong></span>
                        <span style="color: #8C0327; font-weight: bold; font-size: 20px;">${entry.score} punten</span>
                    </div>
                `;
            });
        } else {
            leaderboardDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Nog geen scores. Speel het spel en wees de eerste op de leaderboard!</p>';
        }
        
    } catch (error) {
        console.error('Error loading main leaderboard:', error);
        leaderboardDiv.innerHTML = '<p style="text-align: center; color: #8C0327;">Kon leaderboard niet laden.</p>';
    }
}

function resetGame() {
    document.getElementById('game-end-modal').style.display = 'none';
    
    // Reset save score section
    document.getElementById('player-name').value = '';
    document.getElementById('player-name').disabled = false;
    document.getElementById('save-score-btn').disabled = false;
    document.getElementById('save-feedback').innerHTML = '';
    
    // Clear map
    if (map) {
        if (guessMarker) map.removeLayer(guessMarker);
        if (answerMarker) map.removeLayer(answerMarker);
        map.eachLayer(function(layer) {
            if (layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });
        map.setView([52.1326, 5.2913], 7);
    }
    
    // Restart the game
    startGame();
}

function closeModal() {
    document.getElementById('game-modal').classList.remove('active');
    document.getElementById('game-play-modal').style.display = 'none';
    document.getElementById('game-end-modal').style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
    
    // Clear map layers
    if (map) {
        if (guessMarker) map.removeLayer(guessMarker);
        if (answerMarker) map.removeLayer(answerMarker);
        map.eachLayer(function(layer) {
            if (layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });
    }
}
