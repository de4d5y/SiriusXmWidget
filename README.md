# SiriusXM Desktop Widget

A lightweight Windows desktop radio widget for SiriusXM built with Electron.

## Features
- Compact floating player with expandable channel drawer, search, and genre filters
- Play/Pause, Stop, Previous/Next channel, and **● LIVE** jump-to-live controls
- Favorites list (with a Favorites-only channel cycling toggle)
- Always-on-top pin mode
- 9 built-in themes (Christmas, Blizzard, Thanksgiving, Pumpkin Spice, Autumn Woods, Hearth Gold, Midnight, Synthwave, NyQuil)
- Includes free holiday stream channels plus full SiriusXM web player integration

## Prerequisites
- **Windows 10 / 11**
- **Node.js (LTS)** — download and install from [nodejs.org](https://nodejs.org/) (this includes `npm`, which handles all app dependencies automatically; no Python or extra tools are needed)
- A **SiriusXM streaming account** (for full channel access)

## Installation
1. **Get the code** — either:
   - Click **Code → Download ZIP** on GitHub and extract the folder anywhere on your PC, **or**
   - Clone with Git:
     ```bash
     git clone https://github.com/de4d5y/sxm-widget.git
     cd sxm-widget
     ```
2. **Open a terminal in the project folder** (e.g., open the `sxm-widget` folder in File Explorer, click the address bar, type `powershell`, and press Enter).
3. **Install dependencies** (this downloads Electron and everything the app needs — takes ~1 minute the first time):
   ```bash
   npm install
   ```
   *(If `npm` isn't recognized right after installing Node.js, close and reopen your terminal and try again.)*

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
- **📌:** Toggle Always-on-Top mode.
- **✕:** Close the widget.
