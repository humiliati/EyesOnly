the splash screen on mobile has three distinct columns which are supposed to divide the coin into thirds.

currently the css is dividing the card by about 20% 60% 20% per column.

we need to adjust these by increasing the size of the porthole in the left column and increase the size of the buttons on the right column so that when we divide this into thirds we don't just create a bunch of deadspace.

when we interact with the decoder wheels on mobile the keyboard pops up. the keyboard doesn't need to pop up if the drag on the wheels feels good to adjust group size

lets make sure we are stamping group size selected into the booking form when the user hits "Book.now"

proposed fixes:

Plan: Splash Screen Mobile Fixes
Issue 1: Column Widths (~20%/60%/20% → ~33%/33%/33%)
Location: public/css/splash-screen.css lines 1453-1456

Current:

grid-template-columns: 72px 1fr 70px;  /* ~50px/142px/46px = 20%/60%/20% */
Change: Adjust grid columns for equal thirds on mobile viewport (~33% each):

grid-template-columns: 28% 44% 28%;  /* Adjust porthole, content, buttons */
Also update:

Line 1627: grid-template-columns: 64px 1fr 64px; → adjust for proportion
Lines 1472, 1479: porthole sizing (min-width constraints)
Issue 2: Increase Porthole & Button Sizes
Porthole (left column):

Line 1603-1626: Increase .coin-suit-large and .coin-artwork sizing
Current max ~72px → increase to ~90-100px on mobile
Buttons (right column):

Lines 1531-1548: .coin-wheel-strip and .coin-book-btn sizing
Increase button height/padding for easier touch targets
Issue 3: Decoder Wheel Keyboard Prevention
Location: public/css/splash-screen.css line 1564

Current: .coin-wheel-track { touch-action: none; }

Enhancement: Add CSS to prevent focus:

.coin-wheel-track {
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
.coin-wheel-track:focus {
  outline: none;
}
Also in JS (splash-screen.js around line 437):

Ensure pointerdown handler calls e.preventDefault() to block keyboard:
wheel.addEventListener('pointerdown', function (e) {
  e.preventDefault();  // Add this line
  // ... existing code
});
Issue 4: Group Size Not Stamped in Booking Form
Problem: selectMission() stores eo_group_size in sessionStorage (line 1182), but booking page doesn't read it.

Location: public/js/booking.js around line 36-58 (pre-fill section)

Add:

// Pre-fill group size from splash screen wheel
try {
  var prefillGroup = sessionStorage.getItem('eo_group_size');
  if (prefillGroup) {
    var playersInput = document.getElementById('bf-players');
    if (playersInput) {
      playersInput.value = prefillGroup;
    }
  }
} catch (_) {}
Also clear the sessionStorage after reading (optional, to prevent stale data):

try { sessionStorage.removeItem('eo_group_size'); } catch (_) {}
Files to Modify
File	Changes
public/css/splash-screen.css	Column widths (lines 1456, 1627), porthole size (1603-1626), button size (1531-1548), touch prevention (1564)
public/js/splash-screen.js	Add e.preventDefault() to wheel pointerdown (line ~437)
public/js/booking.js	Read eo_group_size and populate #bf-players (around line 50)