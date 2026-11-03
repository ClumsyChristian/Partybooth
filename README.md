# PartyBooth

A photo booth for parties, weddings and family events. It runs as a **Windows app** (the full version: DSLR, silent printing, email, phone download) and as a **web app** on phones, tablets and any modern browser.

---

## What's in the box

| Download | What it is |
|---|---|
| `PartyBooth-Windows.zip` | Ready-to-run Windows app. Unzip and double-click `PartyBooth.exe`. No install needed. |
| `PartyBooth-Source.zip` | Everything else: |
| &nbsp;&nbsp;`app/` | The booth as a web app. Put it online to use it on phones and tablets (section 6). |
| &nbsp;&nbsp;`desktop/` | Source for the Windows app (Electron), to rebuild it or make an installer. |
| &nbsp;&nbsp;`sample-layouts/` | Two example card layouts to try importing. |
| &nbsp;&nbsp;`docs/card-layouts.md` | How to design your own cards (Canva, Photoshop, or the built-in editor). |

---

## Features

**For guests**
- Big "Tap to start" button, countdown with beeps and a screen flash, and a fun pose idea for each shot ("Bunny ears on someone!"). You can edit the pose list.
- **Photo cards**: 9 built-in layouts (2×6 strips, 4×6 grid, postcard, instant-snap, scrapbook, wedding duo, phone story…) plus any you import.
- **Animated GIFs** with an optional boomerang (plays forward then back).
- **Green screen**: 6 built-in scenes (beach, disco, stars…) or your own pictures. Guests can pick the scene.
- **Decorate before printing**: 11 filters, 32 drag-and-drop props (crowns, sunglasses, mustaches…), finger drawing, and guest-book messages written onto the card.
- **Print**, **Email**, **Share/Save**, and **Phone** (scan a QR code to download — Windows app).
- Confetti, sounds, and a slideshow of the party's photos on the start screen while the booth is idle.

**For the host**
- Settings behind an optional **host PIN**; **kiosk mode** locks the screen to the booth.
- Every photo is saved to the gallery; the Windows app also saves each one to a folder (default: `Pictures\PartyBooth\<event name>`).
- **Download all** as a ZIP, and a slideshow mode for a TV.
- Works with a keyboard, presenter clicker, foot pedal or arcade button: **Space, Enter, B, Page Down or Right arrow** starts a session.
- On-screen keyboard for typing emails on touch screens (with @gmail.com etc. shortcut keys).
- Returns to the start screen after a set idle time, keeps the screen awake, and works without internet.
- **Setup backup**: save your settings and custom layouts to one file (**Download setup**) and load it on another device (**Load setup**). Passwords are left out.

### Windows app vs. browser / phone

| | Windows app | Browser / phone / tablet |
|---|---|---|
| Built-in or USB webcam | ✅ | ✅ (front/back camera on phones) |
| DSLR as a webcam (webcam utility or HDMI capture card) | ✅ | ✅ in Chrome/Edge on a PC |
| DSLR full-resolution via **digiCamControl** (booth fires the shutter) | ✅ | — |
| DSLR via tethering software (watch a folder) | ✅ | ✅ in Chrome/Edge on a PC |
| Printing | Straight to your chosen printer, no dialog | System print dialog (AirPrint, Mopria…) |
| Email | Your own email account (SMTP) or the Google relay | Google relay, or collect addresses to send later |
| Phone download by QR code | ✅ | — |
| Share sheet (Messages, AirDrop, WhatsApp…) | — | ✅ |

---

## 1. Windows: get started (5 minutes)

1. Unzip `PartyBooth-Windows.zip` somewhere permanent, for example `Documents\PartyBooth`.
2. Double-click **PartyBooth.exe**.
   - Windows SmartScreen may say "Windows protected your PC" because the app isn't code-signed. Click **More info → Run anyway**.
   - The first time, Windows may ask whether PartyBooth can use the network. Tick **Private networks** and click **Allow**. This is for the phone-download QR codes.
3. Tap the **gear** (top right) to open Settings. Set the **event name**, pick your camera, printer and email, and choose which card layouts guests can pick.
4. Back on the start screen, press **F11** for full screen (or turn on **Kiosk mode** in Settings → Kiosk & security).

Shortcut keys: **F11** full screen · **Ctrl+Shift+Q** quit · **Esc** cancels a countdown.

Tip: right-click `PartyBooth.exe` → **Send to → Desktop (create shortcut)**.

---

## 2. Connecting a DSLR or mirrorless camera

Pick one of three ways in **Settings → Camera → Camera source**.

### A. As a webcam (easiest, works with most cameras)
Install your camera maker's free webcam app, plug the camera in by USB, then choose it in the booth's camera list:
- Canon: **EOS Webcam Utility** · Nikon: **Webcam Utility** · Sony: **Imaging Edge Webcam** · Fujifilm: **X Webcam** · Panasonic: **LUMIX Webcam Software**
- Or use an **HDMI capture card** (camera's clean HDMI out → capture card → USB). Turn off the camera's on-screen info and auto power-off.

Photos are taken from the video feed (usually 1920×1080). Set **Resolution** to the highest your device offers.

### B. digiCamControl — full-resolution photos (Windows app, best quality)
The booth shows the camera's live view and fires the real shutter at the end of each countdown, then pulls the full-size JPEG.
1. Install the free **digiCamControl** (digicamcontrol.com). It supports most Canon and Nikon bodies and some Sony models.
2. Connect the camera by USB and open digiCamControl. Check it can take a photo.
3. In digiCamControl: **File → Settings → Webserver** → turn on **Use web server** and **Allow interaction via webserver** (port 5513). Restart digiCamControl.
4. Set the camera to shoot **JPEG** (not RAW only).
5. In PartyBooth: Settings → Camera → source **DSLR controlled by digiCamControl** → **Test connection**, then **Test photo**.

Keep digiCamControl open while the booth runs.

### C. Any tethering app — "watch a folder"
Use the software that came with your camera (Canon EOS Utility, Nikon Camera Control Pro, Sony Imaging Edge Remote, Lightroom tethering…) and set it to save JPEGs into a folder. In PartyBooth choose **DSLR with tethering software**, pick that folder, and (optionally) a webcam for the live preview. The booth uses each new photo that lands in the folder. Guests press the shutter, or you can use a remote.

**Camera tips:** use a mains power adapter (dummy battery), turn off auto power-off, manual focus at the standing spot, manual exposure, and bounce a speedlight or use a ring light.

---

## 3. Printing

Settings → **Printing**: choose the printer, paper size (4×6 is standard), max copies per guest, and whether to **print automatically**.

- **2×6 strips** print two-up on 4×6 paper. Cut down the middle, or let an event dye-sub printer (such as DNP) cut it automatically with its 2-inch cut setting.
- Set your printer driver to **borderless 4×6** for edge-to-edge prints.
- In the Windows app, **Print without the dialog** sends straight to the printer.
- In the browser or on a phone/tablet, the system print dialog opens (AirPrint on iPhone/iPad). Choose 4×6 photo paper and borderless.

Good printers: DNP DS620/RX1 and Mitsubishi CP-D70 (event dye-sub), Canon SELPHY CP1500 (budget, home), any inkjet with 4×6 photo paper.

---

## 4. Email

Settings → **Email & sharing → Sending method**:

**My email account (SMTP)** — Windows app
- Tap **Gmail**, **Yahoo** or **iCloud** to fill in the server, then enter your address and an **app password**.
- Gmail: turn on 2-Step Verification, then create an app password at myaccount.google.com → Security → App passwords. Use that 16-letter password, not your normal one.
- Press **Send me a test**.

**Google email relay** — works on every device, free
1. Go to script.google.com → New project.
2. In PartyBooth, press **Copy script** and paste it over the code there.
3. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Approve the permissions.
4. Paste the web app URL into PartyBooth.

Emails come from your Google account (about 100 per day on a free account).

**Collect addresses, send after the party**
Guests type their email; nothing is sent until you press **Send waiting emails now** (or **Download email list** to get a spreadsheet plus the photos). Any email that fails because the internet drops is kept here too.

---

## 5. Phone download (QR code) — Windows app

After a photo, guests tap **Phone** and scan the code with their phone camera. A page opens with their photo and a **Save to my phone** button. It works over the party Wi-Fi with no internet, and each guest only gets their own photo.

- The booth PC and the phones must be on the **same Wi-Fi**. Guest networks that keep devices apart won't work; use the main Wi-Fi or a phone hotspot.
- Add the **Wi-Fi name and password** in Settings → Email & sharing, and the popup also shows a "Join our Wi-Fi" code.
- Use **Scan this with your phone** in that settings section to check it connects before the party.

---

## 6. Phones and tablets (iPhone, iPad, Android)

Phone cameras only work on secure (https) websites, so the `app` folder needs to be online once. Free and quick:

**Netlify Drop (2 minutes, no account needed to try)**
1. On a computer, go to **app.netlify.com/drop**.
2. Drag the **`app`** folder onto the page. You get a link like `https://something.netlify.app`. Sign up (free) to keep it permanently.
3. Open the link on the phone or tablet:
   - **iPhone/iPad (Safari):** Share → **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**.
4. Open it from the home screen. After the first visit it works offline.

(GitHub Pages or Cloudflare Pages work too.)

**Tablet booth tips**
- iPad: Settings → Accessibility → **Guided Access** locks the iPad to the booth. Android: **App pinning**.
- Use **Share** for AirDrop/Messages/WhatsApp, or set up the Google relay for email.
- Print with AirPrint (iPhone/iPad) or Mopria / your printer's app (Android).
- Photos are stored on that device only. Use the gallery's **Download all** to collect them.

---

## 7. Custom card layouts

Settings → **Card layouts → Import layout**. Three kinds of file work:

1. **PNG with transparent windows** (easiest). Design your card in Canva, Photoshop, Affinity, etc. Leave see-through holes where the photos go and export as **PNG with transparent background**. PartyBooth finds the holes automatically and puts a photo behind each one.
2. **JPG or PNG background**. The image becomes the card background; drag photo areas into place in the editor.
3. **Layout file (`.json`)**. Exact positions, text with fill-ins like `{event}` and `{date}`, colours and shapes. Shareable between booths.

You can also start from any built-in layout with **Copy & edit**: move and resize photo areas, add text, change the background, then **Export layout file** to share it.

Card sizes at 300 dpi: 4×6 portrait = 1200×1800 px · 6×4 landscape = 1800×1200 px · 2×6 strip = 600×1800 px.

Full guide with Canva steps: `docs/card-layouts.md`.

---

## 8. Party-day checklist

- [ ] Event name, date line and hashtag set (Settings → Event & look)
- [ ] Camera test photo looks sharp and bright
- [ ] Test print on the real paper; check borders and colours
- [ ] Email: **Send me a test** (or relay set up, or queue mode)
- [ ] Phone download: scan the test code with your phone
- [ ] Host PIN set, kiosk mode on, power-save off
- [ ] Spare paper and ink, extension cord, tape to hold cables
- [ ] After the party: gallery → **Download all**, and send any waiting emails

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Camera problem" or black preview | Close other apps using the camera (Zoom, Teams, the camera maker's app preview). Pick the camera again in Settings → Camera. |
| DSLR webcam utility not listed | Restart PartyBooth after installing the utility; some need the camera in movie mode. |
| digiCamControl "not running" | Open digiCamControl, check the web server is on (port 5513) and that you restarted it after turning it on. |
| digiCamControl takes the photo but the booth times out | Set the camera to JPEG, and raise **Wait for each photo** in Settings → Camera. |
| Prints have white borders | Set the printer's paper to borderless 4×6, and Settings → Printing → **Fit** → **Fill the paper**. |
| Gmail says "username and password not accepted" | Use an app password (see Email above). |
| Phone QR opens but never loads | Phone isn't on the same Wi-Fi, Windows blocked the network (allow PartyBooth in Windows Security → Firewall → Allow an app), or pick the right **Network address** in settings. |
| SmartScreen warning | **More info → Run anyway**. The app isn't code-signed. |

---

## Building from source (optional)

You only need this to change the code or make an installer.

```
cd desktop
npm install
npm start        # run it
npm run dist     # makes an installer and a portable .exe in desktop/dist
```

Requires Node.js 20 or newer on Windows. `npm start` copies `../app` into `desktop/app` first.

To run the web version locally: serve the `app` folder with any web server (for example `npx serve app`) and open it in Chrome or Edge. Opening `index.html` directly also works on a PC, minus offline install.

## Licences

PartyBooth: MIT. Built on Electron (MIT). Fonts (Bungee, Caveat, Nunito, Pacifico, Playfair Display): SIL Open Font License, see `app/fonts/OFL-LICENSE.txt`.
