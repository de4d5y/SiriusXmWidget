# SiriusXM Desktop Widget

A lightweight Windows desktop radio widget for SiriusXM built with Electron.

## Screenshots

### Compact Player
![Compact Player](screenshots/compact.png)

### Channel Browser Drawer
![Channel Browser Drawer](screenshots/expanded.png)

### Theme Picker (Synthwave)
![Theme Picker](screenshots/themes.png)

## Features
- Compact floating player with expandable channel drawer, search, and genre filters
- Play/Pause, Stop, Previous/Next channel, and **● LIVE** jump-to-live controls
- Favorites list (with a Favorites-only channel cycling toggle)
- Always-on-top pin mode
- 9 built-in themes (Christmas, Blizzard, Thanksgiving, Pumpkin Spice, Autumn Woods, Hearth Gold, Midnight, Synthwave, NyQuil)
- Theme-panel transparency dimmer (35–100%), saved between launches
- Music-reactive Christmas lights for Free Holiday Radio streams, using live bass/energy changes when the stream permits audio analysis
- Includes free holiday stream channels plus full SiriusXM web player integration

## Installation

### Option 1: Download the Portable `.exe` (Easiest — No Node.js Required)
1. Go to the [**Releases**](https://github.com/de4d5y/sxm-widget/releases) page on GitHub.
2. Download `SiriusXM-Widget-1.0.0-Portable.exe`.
3. Double-click it to run — no installation or extra software required.
   *(If Windows SmartScreen shows a warning on first launch, click **More info → Run anyway**.)*

### Option 2: Run or Build from Source
**Prerequisites:** Windows 10 / 11 and **Node.js (LTS)** from [nodejs.org](https://nodejs.org/) (includes `npm`).

1. **Get the code** — either:
   - Click **Code → Download ZIP** on GitHub and extract the folder anywhere on your PC, **or**
   - Clone with Git:
     ```bash
     git clone https://github.com/de4d5y/sxm-widget.git
     cd sxm-widget
     ```
2. **Open a terminal in the project folder** (e.g., open the `sxm-widget` folder in File Explorer, click the address bar, type `powershell`, and press Enter).
3. **Install dependencies** (takes ~1 minute the first time):
   ```bash
   npm install
   ```
   *(If `npm` isn't recognized right after installing Node.js, close and reopen your terminal and try again.)*
4. **Run** with `npm start` (or double-click `launch_widget.bat`), or **build your own portable `.exe`** into `dist/` with:
   ```bash
   npm run build
   ```

## Usage
Start the widget using either method:
- Run `npm start` in the project folder, **or**
- Double-click `launch_widget.bat`

### First-Time Sign In
1. Click the **🌐** button in the top-right bar of the widget to show the built-in SiriusXM Web Player window.
2. Sign in with your SiriusXM account.
3. Click **🌐** again to hide the web player window in the background — your login session is saved locally in your Windows user profile (`%APPDATA%`), so you won't need to sign in every time.

### Controls
- **Album Art / Channel Badge:** Click to expand or collapse the channel browser drawer.
- **★ (next to channel name):** Add or remove the current channel from Favorites.
- **★ (top bar):** Toggle Prev/Next buttons between cycling all channels vs. Favorites only.
- **● LIVE:** Jump back to the live broadcast if the stream falls behind.
- **🎨:** Switch widget themes.
- **🎨 → Transparency:** Dim the entire widget while keeping its transparent desktop background.
- **🎨 → Music-reactive Christmas lights:** Toggle real-time light pulses for Free Holiday Radio. SiriusXM web-player audio is isolated in its own window and cannot be sampled by the widget.
- **📌:** Toggle Always-on-Top mode.
- **✕:** Close the widget.
