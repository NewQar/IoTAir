// register.js - Handle user registration

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    // Clear previous messages
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    successDiv.textContent = '';
    successDiv.classList.remove('show');
    
    // Validate passwords match
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match!';
        errorDiv.classList.add('show');
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters long.';
        errorDiv.classList.add('show');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Registration successful
            successDiv.textContent = 'Registration successful! Redirecting to login...';
            successDiv.classList.add('show');
            
            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            // Show error message
            errorDiv.textContent = data.error || 'Registration failed. Please try again.';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorDiv.textContent = 'Network error. Please check your connection.';
        errorDiv.classList.add('show');
    }
});