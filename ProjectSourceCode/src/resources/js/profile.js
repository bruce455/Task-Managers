// public/js/profile.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editProfileForm');
    if (!form) return;
  
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const body = {
        username: form.username.value.trim(),
        email   : form.email.value.trim(),
        password: form.password.value.trim()
      };
      if (!body.password) delete body.password;         // keep current pw if blank
  
      try {
        const res   = await fetch('/profile', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(body)
        });
        const json  = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Update failed');
  
        // Success – just refresh so the new info shows up
        window.location.reload();
      } catch (err) {
        alert(err.message || 'Could not update profile.');
        console.error(err);
      }
    });
  });
  