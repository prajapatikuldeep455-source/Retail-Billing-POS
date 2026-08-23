# 🛒 Retail POS & Inventory System

A complete, full-stack Point of Sale (POS) and Inventory Management system built for modern retail stores. It features a beautiful React frontend, a robust Node.js/SQLite backend, and can be compiled into a standalone Windows `.exe` desktop application using Electron.

## ✨ Core Features
* **Fast Billing & Checkout:** Streamlined interface for quick customer checkouts.
* **Inventory Management:** Track stock levels in real-time, get low stock alerts, and toggle negative stock billing.
* **Hardware Machine Binding:** Secure software license management tied to the physical hardware ID of the local machine.
* **Dynamic UPI QR Integration:** Automatically generates UPI QR codes for seamless customer payments based on total bill amount.
* **Thermal Printer Support:** ESC/POS compatible receipt printing with customizable invoice footer policies.
* **Role-Based Security:** Admin and Cashier PIN controls to restrict access to sensitive business modules.
* **Standalone Windows Executable:** Fully wrapped as an Electron desktop app with an automated GitHub Actions CI/CD pipeline.

## 🛠️ Tech Stack
* **Frontend:** React 19, Tailwind CSS v4, Vite, Lucide Icons.
* **Backend:** Node.js, Express.js.
* **Database:** SQLite (using `@libsql/client`).
* **Desktop Environment:** Electron, `electron-builder`.

## 💻 System Requirements
This software is optimized for maximum compatibility, specifically designed to run incredibly smoothly even on old or low-end hardware. Hardware acceleration has been disabled by default to prevent crashes on laptops with weak or no dedicated graphics cards.

* **Operating System:** Windows 7, Windows 8, Windows 10, or Windows 11 (64-bit)
* **Processor (CPU):** Intel Core i3 / AMD Ryzen 3 or equivalent (even 10+ year old CPUs like Core 2 Duo are supported)
* **Memory (RAM):** 2GB Minimum (4GB Recommended for smoothest experience)
* **Storage:** 200MB of available disk space
* **Graphics:** No dedicated GPU required (Software renders via CPU)

## 🚀 Getting Started (Development)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run the Development Server:**
   This will concurrently start the Vite React frontend (port 3000) and the Node.js backend API (port 3001).
   ```bash
   npm run dev
   ```

3. **View in Browser:**
   Open `http://localhost:3000`

## 📦 Building for Production (Windows .exe)

This repository is configured with an automated **GitHub Actions CI/CD Pipeline**. 

### The Easy Way (Automated via GitHub):
1. Push your code to the `main` or `master` branch on GitHub.
2. Go to the **Actions** tab in your GitHub repository.
3. You will see the **Build POS EXE** workflow running automatically.
4. Once it turns green (finished), click on the workflow run.
5. Scroll down to **Artifacts** and download the `POS-Machine-Windows` zip file.
6. Extract the zip to find your standalone `.exe` installer!

### The Manual Way (Local Machine):
If you want to compile the `.exe` directly on your local Windows PC, run:
```bash
# 1. Build the React UI
npm run build

# 2. Bundle the Node.js Server
npx esbuild server.ts --bundle --platform=node --target=node20 --outfile=server.js --external:@libsql/client --external:sqlite3

# 3. Pack into an Executable using Electron
npx electron-builder --win --x64
```
The installer will be generated in the `release/` folder.

## 📄 License
Proprietary / Commercial Software. All rights reserved.
