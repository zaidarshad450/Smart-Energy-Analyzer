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

  // Dark mode toggle for auth pages
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const icon = darkModeToggle.querySelector("i");
      if (document.body.classList.contains("dark-mode")) {
        icon.className = "fas fa-sun";
        darkModeToggle.innerHTML = `<i class="fas fa-sun"></i> Light Mode`;
      } else {
        icon.className = "fas fa-moon";
        darkModeToggle.innerHTML = `<i class="fas fa-moon"></i> Dark Mode`;
      }
    });
  }
});
