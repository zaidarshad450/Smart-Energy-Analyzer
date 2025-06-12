// Redirect logged-in users from login or signup to dashboard
if (
  localStorage.getItem("currentUser") &&
  (location.pathname.endsWith("login.html") || location.pathname.endsWith("signup.html"))
) {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  if (signupForm) {
    signupForm.addEventListener("submit", e => {
      e.preventDefault();
      const username = document.getElementById("signup-username").value.trim();
      const password = document.getElementById("signup-password").value.trim();

      if (localStorage.getItem(`user_${username}`)) {
        alert("Username already exists!");
      } else {
        localStorage.setItem(`user_${username}`, password);
        alert("Registered successfully! Please log in.");
        window.location.href = "login.html";
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value.trim();
      const storedPassword = localStorage.getItem(`user_${username}`);

      if (storedPassword === password) {
        localStorage.setItem("currentUser", username);
        window.location.href = "index.html";
      } else {
        alert("Invalid username or password");
      }
    });
  }

  // Change Password Logic
  const changePasswordBtn = document.getElementById("change-password-btn");
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      const currentUser = localStorage.getItem("currentUser");
      if (!currentUser) {
        alert("Please log in first.");
        window.location.href = "login.html";
        return;
      }

      const oldPass = prompt("Enter your current password:");
      if (oldPass === null) return; // Cancelled prompt

      const storedPass = localStorage.getItem(`user_${currentUser}`);
      if (oldPass !== storedPass) {
        alert("Incorrect current password.");
        return;
      }

      const newPass = prompt("Enter your new password:");
      if (newPass === null || newPass.trim() === "") {
        alert("New password cannot be empty.");
        return;
      }

      const confirmPass = prompt("Confirm your new password:");
      if (confirmPass === null) return;

      if (newPass !== confirmPass) {
        alert("Passwords do not match.");
        return;
      }

      localStorage.setItem(`user_${currentUser}`, newPass);
      alert("Password changed successfully!");
    });
  }
});
