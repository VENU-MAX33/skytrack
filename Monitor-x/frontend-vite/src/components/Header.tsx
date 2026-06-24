import { Bell, ChevronDown, User } from "lucide-react";

export default function Header() {
  return (
    <header className="main-header bg-white flex items-stretch">
      {/* Logo Area */}
      <div className="w-[230px] h-[51px] flex items-center justify-start px-4 border-r border-[#E0E4E9] overflow-hidden">
        <a href="/dashboard" className="flex items-center">
          <img
            src="/monitorx-logo.png"
            alt="MonitorX"
            className="h-[40px] w-auto rounded-md"
          />
        </a>
      </div>

      {/* Navbar */}
      <nav className="flex-1 flex items-center justify-between px-4 bg-white h-[51px]">
        {/* Left side - Company Icon */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#D22630] rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">IM</span>
          </div>
          <span className="text-[#777777] text-[13px]">Ironmountain</span>
        </div>

        {/* Right side - User actions */}
        <div className="flex items-center gap-4">
          {/* Tenant Dropdown */}
          <button className="flex items-center gap-2 text-[13px] text-[#222222] hover:bg-[#F5F6FA] px-3 py-1.5 rounded">
            <span>Ironmountain</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <button className="relative p-2 hover:bg-[#F5F6FA] rounded">
            <Bell className="w-4 h-4 text-[#222222]" />
          </button>

          {/* User Avatar */}
          <button className="flex items-center gap-2 p-1 hover:bg-[#F5F6FA] rounded">
            <div className="w-[26px] h-[26px] rounded-full bg-[#0047B2] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      </nav>
    </header>
  );
}
