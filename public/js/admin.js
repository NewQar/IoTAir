// admin.js - Admin panel functionality

let users = [];
let confirmCallback = null;

// Check if user is admin
async function checkAdminAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (!response.ok || !data.authenticated) {
            window.location.href = 'index.html';
            return;
        }
        
        if (data.user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'dashboard.html';
            return;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'index.html';
    }
}

// Fetch all users
async function fetchUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (response.ok) {
            users = data.users;
            updateUserTable();
            updateStats();
        }
    } catch (error) {
        console.error('Failed to fetch users:', error);
    }
}

// Update user table
function updateUserTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        const roleClass = user.role === 'admin' ? 'btn-success' : 'btn-secondary';
        const roleText = user.role === 'admin' ? 'Admin' : 'User';
        
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>
                <button class="btn ${roleClass} btn-sm" onclick="toggleRole('${user.email}', '${user.role}')">
                    ${roleText}
                </button>
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.email}')">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update statistics
function updateStats() {
    const totalUsers = users.length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const totalRegular = totalUsers - totalAdmins;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalAdmins').textContent = totalAdmins;
    document.getElementById('totalRegular').textContent = totalRegular;
}

// Toggle user role
window.toggleRole = function(email, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    showConfirm(
        `Change role to ${newRole.toUpperCase()} for ${email}?`,
        async () => {
            try {
                const response = await fetch(`/api/users/${encodeURIComponent(email)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ role: newRole })
                });
                
                if (response.ok) {
                    await fetchUsers();
                } else {
                    const data = await response.json();
                    alert('Failed to update role: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Failed to update role:', error);
                alert('Network error. Please try again.');
            }
        }
    );
};

// Delete user
window.deleteUser = function(email) {
    showConfirm(
        `Are you sure you want to delete user ${email}?`,
        async () => {
            try {
                const response = await fetch(`/api/users/${encodeURIComponent(email)}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    await fetchUsers();
                } else {
                    const data = await response.json();
                    alert('Failed to delete user: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Failed to delete user:', error);
                alert('Network error. Please try again.');
            }
        }
    );
};

// Add user modal
const addUserModal = document.getElementById('addUserModal');
const addUserBtn = document.getElementById('addUserBtn');
const closeModal = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');

addUserBtn.addEventListener('click', () => {
    addUserModal.classList.add('show');
    document.getElementById('addUserForm').reset();
    document.getElementById('modalError').textContent = '';
    document.getElementById('modalError').classList.remove('show');
});

closeModal.addEventListener('click', () => {
    addUserModal.classList.remove('show');
});

cancelBtn.addEventListener('click', () => {
    addUserModal.classList.remove('show');
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === addUserModal) {
        addUserModal.classList.remove('show');
    }
});

// Add user form submission
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('newName').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const errorDiv = document.getElementById('modalError');
    
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    
    try {
        const response = await fetch('/api/users/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, role })
        });
        
        if (response.ok) {
            addUserModal.classList.remove('show');
            await fetchUsers();
        } else {
            const data = await response.json();
            errorDiv.textContent = data.error || 'Failed to add user';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        console.error('Failed to add user:', error);
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
});

// Confirmation modal
function showConfirm(message, callback) {
    const confirmModal = document.getElementById('confirmModal');
    document.getElementById('confirmMessage').textContent = message;
    confirmModal.classList.add('show');
    
    confirmCallback = callback;
}

document.getElementById('confirmYes').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('show');
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
    }
});

document.getElementById('confirmNo').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
});

// Dashboard button
document.getElementById('dashboardBtn').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

// Logout button
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/logout');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Initialize
checkAdminAuth();
fetchUsers();