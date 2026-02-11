// Configuration - Replace these with your actual values
const SUPABASE_URL = ''; // Update this
const SUPABASE_ANON_KEY = ''; // Update this
const API_BASE_URL = window.location.origin; // Use same origin for API

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let currentUser = null;
let pricingPlans = [];
let userServers = [];

// Initialize app
async function init() {
    showLoading();
    
    // Check authentication status
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadDashboard();
    } else {
        showLandingPage();
        await loadPricingPlans();
    }
    
    hideLoading();
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            loadDashboard();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showLandingPage();
        }
    });
}

// Authentication
async function handleSignIn() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
    } catch (error) {
        console.error('Sign in error:', error);
        alert('Failed to sign in. Please try again.');
    }
}

async function handleSignOut() {
    try {
        await supabase.auth.signOut();
        showLandingPage();
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// UI Functions
function showLandingPage() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
    updateNavButtons(false);
}

function showDashboard() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    updateNavButtons(true);
}

function updateNavButtons(isLoggedIn) {
    const navButtons = document.getElementById('nav-buttons');
    
    if (isLoggedIn) {
        navButtons.innerHTML = `
            <div class="flex items-center space-x-4">
                <span class="text-sm text-gray-600">${currentUser.email}</span>
                <button onclick="handleSignOut()" class="text-gray-600 hover:text-gray-900">Sign Out</button>
            </div>
        `;
    } else {
        navButtons.innerHTML = `
            <button onclick="handleSignIn()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                Sign In
            </button>
        `;
    }
}

function showLoading() {
    document.getElementById('loading-spinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-spinner').classList.add('hidden');
}

// API Functions
async function apiCall(endpoint, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        }
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }
    
    return response.json();
}

// Pricing Plans
async function loadPricingPlans() {
    try {
        pricingPlans = await apiCall('/api/plans');
        renderPricingCards();
    } catch (error) {
        console.error('Error loading pricing plans:', error);
    }
}

function renderPricingCards() {
    const container = document.getElementById('pricing-cards');
    
    container.innerHTML = pricingPlans.map(plan => `
        <div class="bg-white rounded-lg shadow-lg p-6 ${plan.popular ? 'ring-2 ring-purple-600' : ''} card-hover relative">
            ${plan.popular ? '<div class="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg rounded-tr-lg">POPULAR</div>' : ''}
            <h3 class="text-2xl font-bold mb-2">${plan.name}</h3>
            <div class="text-4xl font-bold mb-4">$${plan.price}<span class="text-lg text-gray-500">/mo</span></div>
            <div class="mb-4 text-sm text-gray-600">
                <div class="font-semibold mb-2">Specs:</div>
                <div class="space-y-1">
                    <div>• ${plan.specs.cpu}</div>
                    <div>• ${plan.specs.ram} RAM</div>
                    <div>• ${plan.specs.storage} Storage</div>
                    <div>• ${plan.specs.bandwidth} Transfer</div>
                </div>
            </div>
            <div class="border-t pt-4 mb-4">
                ${plan.features.map(f => `<div class="flex items-center mb-2 text-sm"><span class="text-green-500 mr-2">✓</span>${f}</div>`).join('')}
            </div>
            <button onclick="handleSignIn()" class="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition">
                Get Started
            </button>
        </div>
    `).join('');
}

// Dashboard
async function loadDashboard() {
    showDashboard();
    await Promise.all([
        loadServers(),
        loadStats(),
        loadPricingPlans()
    ]);
}

async function loadStats() {
    try {
        const stats = await apiCall('/api/stats');
        document.getElementById('stat-total').textContent = stats.totalServers;
        document.getElementById('stat-running').textContent = stats.activeServers;
        document.getElementById('stat-stopped').textContent = stats.stoppedServers;
        document.getElementById('stat-provisioning').textContent = stats.provisioning;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadServers() {
    try {
        userServers = await apiCall('/api/servers');
        renderServersList();
    } catch (error) {
        console.error('Error loading servers:', error);
        document.getElementById('servers-list').innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                Failed to load servers. Please refresh the page.
            </div>
        `;
    }
}

function renderServersList() {
    const container = document.getElementById('servers-list');
    const emptyState = document.getElementById('empty-state');
    
    if (userServers.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = userServers.map(server => {
        const statusColors = {
            running: 'bg-green-100 text-green-800',
            stopped: 'bg-orange-100 text-orange-800',
            provisioning: 'bg-blue-100 text-blue-800',
            pending: 'bg-blue-100 text-blue-800',
            stopping: 'bg-yellow-100 text-yellow-800',
            starting: 'bg-yellow-100 text-yellow-800',
            terminated: 'bg-red-100 text-red-800',
            failed: 'bg-red-100 text-red-800'
        };
        
        const statusColor = statusColors[server.status] || 'bg-gray-100 text-gray-800';
        const plan = pricingPlans.find(p => p.id === server.plan_type) || {};
        
        return `
            <div class="bg-white rounded-lg shadow-sm p-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold mb-1">${plan.name || server.plan_type} Server</h3>
                        <div class="flex items-center space-x-3 text-sm text-gray-600">
                            <span>${server.instance_type}</span>
                            ${server.ip_address ? `<span>• ${server.ip_address}</span>` : ''}
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">
                        ${server.status.toUpperCase()}
                    </span>
                </div>
                
                ${server.ip_address && server.status === 'running' ? `
                    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div class="text-sm text-gray-600 mb-1">Server URL:</div>
                        <a href="http://${server.ip_address}" target="_blank" class="text-purple-600 hover:text-purple-700 font-mono text-sm break-all">
                            http://${server.ip_address} ↗
                        </a>
                    </div>
                ` : ''}
                
                <div class="text-xs text-gray-500 mb-4">
                    Created: ${new Date(server.created_at).toLocaleDateString()}
                </div>
                
                <div class="flex space-x-2">
                    ${server.status === 'running' ? `
                        <button onclick="controlServer('${server.id}', 'stop')" class="flex-1 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 text-sm font-semibold">
                            Stop
                        </button>
                        <button onclick="controlServer('${server.id}', 'reboot')" class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm font-semibold">
                            Reboot
                        </button>
                    ` : server.status === 'stopped' ? `
                        <button onclick="controlServer('${server.id}', 'start')" class="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm font-semibold">
                            Start
                        </button>
                    ` : ''}
                    ${server.status !== 'provisioning' && server.status !== 'pending' ? `
                        <button onclick="deleteServer('${server.id}')" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-semibold">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Server Actions
async function controlServer(serverId, action) {
    try {
        showLoading();
        await apiCall(`/api/servers/${serverId}/${action}`, { method: 'POST' });
        
        // Wait a bit then reload
        setTimeout(async () => {
            await loadServers();
            await loadStats();
            hideLoading();
        }, 2000);
    } catch (error) {
        hideLoading();
        alert(`Failed to ${action} server: ${error.message}`);
    }
}

async function deleteServer(serverId) {
    if (!confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        await apiCall(`/api/servers/${serverId}`, { method: 'DELETE' });
        await loadServers();
        await loadStats();
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(`Failed to delete server: ${error.message}`);
    }
}

// Create Server Modal
function showCreateServerModal() {
    const modal = document.getElementById('create-server-modal');
    const container = document.getElementById('modal-pricing-cards');
    
    container.innerHTML = pricingPlans.map(plan => `
        <div class="border rounded-lg p-6 ${plan.popular ? 'border-purple-600 border-2' : 'border-gray-200'} hover:shadow-lg transition cursor-pointer" onclick="createServer('${plan.id}', '${plan.instanceType}')">
            ${plan.popular ? '<div class="text-purple-600 text-xs font-semibold mb-2">RECOMMENDED</div>' : ''}
            <h3 class="text-xl font-bold mb-2">${plan.name}</h3>
            <div class="text-3xl font-bold mb-3">$${plan.price}<span class="text-sm text-gray-500">/mo</span></div>
            <div class="space-y-1 text-sm text-gray-600 mb-4">
                <div>• ${plan.specs.cpu}</div>
                <div>• ${plan.specs.ram} RAM</div>
                <div>• ${plan.specs.storage}</div>
            </div>
            <button class="w-full bg-purple-600 text-white py-2 rounded font-semibold hover:bg-purple-700">
                Create Server
            </button>
        </div>
    `).join('');
    
    modal.classList.remove('hidden');
}

function hideCreateServerModal() {
    document.getElementById('create-server-modal').classList.add('hidden');
}

async function createServer(planId, instanceType) {
    try {
        hideCreateServerModal();
        showLoading();
        
        await apiCall('/api/servers', {
            method: 'POST',
            body: JSON.stringify({ planId, instanceType })
        });
        
        alert('Server creation started! It will be ready in 2-3 minutes.');
        
        // Reload after a delay
        setTimeout(async () => {
            await loadServers();
            await loadStats();
            hideLoading();
        }, 3000);
        
        // Auto-refresh every 10 seconds for the first minute
        let refreshCount = 0;
        const refreshInterval = setInterval(async () => {
            refreshCount++;
            if (refreshCount > 6) {
                clearInterval(refreshInterval);
                return;
            }
            await loadServers();
            await loadStats();
        }, 10000);
        
    } catch (error) {
        hideLoading();
        alert(`Failed to create server: ${error.message}`);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

// Auto-refresh servers every 30 seconds when on dashboard
setInterval(async () => {
    if (!document.getElementById('dashboard-page').classList.contains('hidden')) {
        await loadServers();
        await loadStats();
    }
}, 30000);
