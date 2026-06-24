import { useState, useEffect, useMemo } from "react";
import { Settings, Search, Download } from "lucide-react";
import { getEmployees, getVehicles, getDrivers, setEmployeeActive, setVehicleActive, setDriverActive } from "../api";
import type { Employee, Vehicle, Driver } from "../api";
import { exportToCsv } from "../lib/exportCsv";

export default function ActivateDeactivate() {
  const [activeTab, setActiveTab] = useState<"employee" | "vehicle" | "driver">("employee");
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    getEmployees().then(setEmployees);
    getVehicles().then(setVehicles);
    getDrivers().then(setDrivers);
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const filteredVehicles = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles.filter(
      (v) => v.rtoNo.toLowerCase().includes(q) || v.vendor.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const filteredDrivers = useMemo(() => {
    const q = search.toLowerCase();
    return drivers.filter(
      (d) => d.name.toLowerCase().includes(q) || d.vendor.toLowerCase().includes(q)
    );
  }, [drivers, search]);

  function handleExport() {
    if (activeTab === "employee") exportToCsv("employees.csv", filteredEmployees);
    else if (activeTab === "vehicle") exportToCsv("vehicles.csv", filteredVehicles);
    else exportToCsv("drivers.csv", filteredDrivers);
  }

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Activation/Deactivation</h1>
        </div>
        <button
          onClick={handleExport}
          className="bg-[#F5F6FA] text-[#222222] border border-[#E0E4E9] px-4 py-2 rounded text-[13px] hover:bg-[#E0E4E9] transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(["employee", "vehicle", "driver"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearch(""); }}
            className={`px-4 py-2 rounded-t text-[13px] capitalize transition-colors ${
              activeTab === tab
                ? "bg-[#0047B2] text-white"
                : "bg-white text-[#777777] hover:bg-[#F5F6FA]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="dashboard-card p-4 mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#777777]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}…`}
            className="flex-1 border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
          />
        </div>
      </div>

      {/* Employee Table */}
      {activeTab === "employee" && (
        <div className="dashboard-card overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>EMP ID</th>
                <th>TRANSPORT TYPE</th>
                <th>TRANSPORT MODE</th>
                <th>TEAM</th>
                <th>ACTIVE</th>
                <th>LOGIN RESTRICTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#777777]">No items to display</td></tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="font-medium">{emp.name}</td>
                    <td>{emp.id}</td>
                    <td>{emp.transportType}</td>
                    <td>{emp.transportMode}</td>
                    <td>{emp.team}</td>
                    <td>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={emp.active === "Yes"}
                          onChange={(e) => setEmployeeActive(emp.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0047B2]"></div>
                      </label>
                    </td>
                    <td></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Vehicle Table */}
      {activeTab === "vehicle" && (
        <div className="dashboard-card overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>VEHICLE RTO NO</th>
                <th>MODEL</th>
                <th>VEHICLE TYPE</th>
                <th>VENDOR</th>
                <th>FUEL TYPE</th>
                <th>ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-[#777777]">No items to display</td></tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.rtoNo}>
                    <td className="font-medium">{v.rtoNo}</td>
                    <td>{v.model}</td>
                    <td>{v.vehicleType}</td>
                    <td>{v.vendor}</td>
                    <td>{v.fuelType}</td>
                    <td>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={v.active === "Yes"}
                          onChange={(e) => setVehicleActive(v.rtoNo, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0047B2]"></div>
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Driver Table */}
      {activeTab === "driver" && (
        <div className="dashboard-card overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>DL NUMBER</th>
                <th>CONTACT</th>
                <th>VENDOR</th>
                <th>INDUCTION DATE</th>
                <th>ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-[#777777]">No items to display</td></tr>
              ) : (
                filteredDrivers.map((d, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{d.name}</td>
                    <td>{d.dlNumber}</td>
                    <td>{d.contact}</td>
                    <td>{d.vendor}</td>
                    <td>{d.inductionDate}</td>
                    <td>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={d.active === "Yes"}
                          onChange={(e) => setDriverActive(d.name, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0047B2]"></div>
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
