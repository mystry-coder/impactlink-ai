import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { db } from "../firebase/config";
import { collection, onSnapshot } from "firebase/firestore";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ✅ Fix marker icon issue
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView() {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "needs"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLocations(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ width: "100%" }}>
      <h2 style={{ margin: "20px 0", textAlign: "center" }}>
        🌍 Live Impact Map
      </h2>

      <div
        style={{
          height: "90vh",
          width: "100%",
        }}
      >
        <MapContainer
          center={[22.5726, 88.3639]}
          zoom={10}
          style={{ height: "100%", width: "100%", borderRadius: "12px" }}
        >
          {/* 🌐 OpenStreetMap */}
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* 📍 Markers */}
          {locations.map((loc) => {
            const lat = Number(loc.lat);
            const lng = Number(loc.lng);

            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker key={loc.id} position={[lat, lng]}>
                <Popup>
                  <strong>{loc.title}</strong> <br />
                  {loc.description} <br />
                  📍 {loc.location}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}