<div align="center">

  <img src="./readme-assets/ui.png" alt="kotofy interface" width="100%" />

  <br />
  <br />

  <h1>琴 · kotofy</h1>
  <p>
    <strong>pure speed</strong> &nbsp;│&nbsp;
    <strong>zero latency</strong> &nbsp;│&nbsp;
    <strong>hardware-grade precision</strong>
  </p>

  <p>
    <em>modern, ultra-low latency macro automation engine for windows.</em><br />
    <small>engineered with japanese aesthetic minimalism, hybrid sub-millisecond qpc scheduler, and zero bloat.</small>
  </p>

  <p>
    <a href="https://github.com/prfctcondition/kotofy/releases/latest"><img src="https://img.shields.io/github/v/release/prfctcondition/kotofy?color=emerald&label=release&style=flat-square" alt="release" /></a>
    <img src="https://img.shields.io/badge/platform-windows%2010%20%2f%2011-0078d6?style=flat-square&logo=windows&logocolor=white" alt="platform" />
    <img src="https://img.shields.io/badge/rust-2021-dea584?style=flat-square&logo=rust&logocolor=white" alt="rust" />
    <img src="https://img.shields.io/badge/tauri-v2-24c8d8?style=flat-square&logo=tauri&logocolor=white" alt="tauri" />
    <img src="https://img.shields.io/badge/react-19-20232a?style=flat-square&logo=react&logocolor=61dafb" alt="react" />
    <img src="https://img.shields.io/badge/typescript-5.8-007acc?style=flat-square&logo=typescript&logocolor=white" alt="typescript" />
    <img src="https://img.shields.io/badge/tailwind_css-4-38b2ac?style=flat-square&logo=tailwind-css&logocolor=white" alt="tailwind" />
    <a href="license"><img src="https://img.shields.io/badge/license-mit-green.svg?style=flat-square" alt="license" /></a>
  </p>

  <br />

  <p>
    <a href="https://github.com/prfctcondition/kotofy/releases/latest">
      <img src="https://img.shields.io/badge/download_kotofy_for_windows-18181b?style=for-the-badge&logo=windows&logocolor=white" alt="download windows setup" height="38" />
    </a>
  </p>

  <br />
</div>

---

## ✦ why kotofy?

> *legacy macro tools built on heavy runtimes suffer from timer jitter, gc pauses, and cluttered interfaces.*

**kotofy is a complete reimagining of the legacy zen zakura macro.**

rewritten from scratch in **rust** and **tauri v2**, kotofy focuses on clean performance, sub-millisecond execution accuracy, minimal resource usage, and a quiet nordic liquid glass interface. everything has been refined: lower latency, instant hotkey binding, hardware-level scancode injection, zero-overhead background window filtering, and seamless tray integration.

---

## ✧ architecture & features

### ▸ 01. hybrid sub-millisecond scheduler
- **hardware-level precision**: utilizes `queryperformancecounter` (qpc) and multimedia timer resolution (`timebeginperiod(1)`) to bypass standard windows timer quantums.
- **zero-drift micro-sleep**: hybrid algorithm that sleeps cooperatively and spins during final microseconds, delivering sub-0.05ms dispatch accuracy.
- **low-level injection**: uses win32 `sendinput` with hardware scancodes (`keyeventf_scancode`) to eliminate dropped inputs in competitive games.

### ▸ 02. zero-overhead process filtering
- **atomic hot path**: macro execution reads an atomic memory flag (`is_target_active.load(relaxed)`) with 0 ns overhead and zero heap allocations.
- **background watcher**: a 50ms background thread monitors foreground window transitions, resolves root process executables (`getancestor(ga_rootowner)` + `queryfullprocessimagenamew`), and prevents handle leaks.

### ▸ 03. execution modes & controls
- **single execution**: plays the sequence once per hotkey trigger.
- **repeat while held**: loops cleanly while the hotkey is held down, breaking immediately on release.
- **toggle loop**: toggles continuous playback on first press, stops on second press.
- **global killswitch (f12)**: halts active macros, stops background repeat threads, and safely releases any held virtual keys across the system.

### ▸ 04. nordic liquid glass interface
- **minimalist aesthetic**: light frosted glass panels, subtle border reflections, and crisp typography crafted for focus.
- **profile management**: create, switch, and export tailored profiles for games or desktop workflows.
- **live recorder & step editor**: record key actions with microsecond timings, adjust batch delays, and rearrange steps easily.

### ▸ 05. system tray & window lifecycle
- **close-to-tray**: minimizing or closing the window hides kotofy directly to the system tray with zero taskbar footprint (`skip_taskbar`).
- **instant restore**: left-click the tray icon or use the native context menu to bring the window back into focus immediately.

---

## ⚡ architectural comparison

| dimension | **kotofy (rust v0.1.0)** | **zen zakura macro (legacy)** | **generic macro tools** |
| :--- | :--- | :--- | :--- |
| **runtime engine** | **native rust + win32 api** | c# / .net framework | c# / electron / python |
| **timer precision** | **< 0.05 ms (qpc + spin-wait)** | ~15.6 ms (thread.sleep) | 10 – 20 ms os jitter |
| **process filter overhead** | **0 ns (atomic background watcher)** | synchronous win32 calls | polled wmi / process list |
| **memory footprint** | **~35 mb** | ~180 mb | ~300+ mb |
| **interface design** | **nordic liquid glass (react 19)** | classic wpf | generic dark mode |
| **input injection** | **hardware scancodes (sendinput)** | virtual key codes | virtual key codes |
| **system tray integration** | **zero-taskbar tray with quick restore** | basic minimize | inconsistent tray hooks |
| **privacy & telemetry** | **100% offline · zero telemetry** | closed source | account login / tracking |

---

## ⚙ installation

### windows setup (recommended)
1. download the latest installer from the [releases page](https://github.com/prfctcondition/kotofy/releases/latest):
   - **`kotofy-windows-setup-v0.1.0.exe`**
2. run the setup wizard to install kotofy with desktop and start menu shortcuts.
3. launch kotofy and configure your profiles.

---

## ⚙ building from source

### prerequisites
- [rust](https://rustup.rs/) *(latest stable toolchain)*
- [node.js](https://nodejs.org/) *(v18 or newer)*
- windows 10/11 with c++ build tools

### setup & run
```bash
# 1. clone the repository
git clone https://github.com/prfctcondition/kotofy.git
cd kotofy

# 2. install dependencies
npm install

# 3. launch desktop development environment
npm run tauri dev
```

### packaging production binary & installer
```bash
# compile release binary
npm run tauri build

# compile inno setup installer
iscc installer.iss
```
the output installer will be generated in `installer_output/kotofy-windows-setup-v0.1.0.exe`.

---

## ☆ support

kotofy is free, open-source, and dedicated to pure performance and privacy. there are zero subscriptions, ads, or trackers.

if kotofy brought precision to your setup, support for the craft is received with quiet gratitude:

<p align="center">
  <a href="https://ko-fi.com/prfctcondition">
    <img src="https://img.shields.io/badge/ko--fi-support%20the%20craft-f16061?style=for-the-badge&logo=ko-fi&logocolor=white" alt="support on ko-fi" />
  </a>
  <br />
  <sub><a href="https://ko-fi.com/prfctcondition">ko-fi.com/prfctcondition</a></sub>
</p>

---

## ✦ engineering & philosophy

kotofy was engineered as a high-performance, zero-overhead desktop utility. reimagining the original zen zakura macro in rust removed all runtime bloat, gc pauses, and ui latency.

> *「 craft with intent, ship without bloat. 」*

## 🕮 license

distributed under the [mit license](license). built for players and creators who value speed, precision, and craftsmanship.
