import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { MapPin, AlertCircle } from "lucide-react";
import { generateMatchExplanation } from "../ai/gemini";
import "./ReportNeed.css";

export default function Dashboard() {
  const [needs, setNeeds] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [explanations, setExplanations] = useState({});

  useEffect(() => {
    fetchNeeds();
    fetchVolunteers();
  }, []);

  const fetchNeeds = async () => {
    try {
      const q = query(collection(db, "needs"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setNeeds(data);
    } catch (error) {
      console.log("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVolunteers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "volunteers"));

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setVolunteers(data);
    } catch (error) {
      console.log("Volunteer fetch error:", error);
    }
  };

  // 📍 Distance calculation (Haversine)
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // Matching logic
  const getMatches = (need) => {
    const keywords = [
      "food", "book", "medical", "education",
      "clothes", "copy", "stationery", "teaching", "sports"
    ];

    const needText = (need.title + " " + need.description).toLowerCase();

    return volunteers
      .map((v) => {
        const skillsText = v.skills?.toLowerCase() || "";

        // 🔹 Skill score
        let skillScore = 0;
        keywords.forEach((word) => {
          if (needText.includes(word) && skillsText.includes(word)) {
            skillScore += 1;
          }
        });

        // 🔹 Distance-based location score
        let locationScore = 0;

        if (v.lat && v.lng && need.lat && need.lng) {
          const distance = getDistance(
            Number(v.lat),
            Number(v.lng),
            Number(need.lat),
            Number(need.lng)
          );

          if (distance < 10) locationScore = 3;
          else if (distance < 50) locationScore = 2;
          else if (distance < 100) locationScore = 1;
        }

        // 🔹 Urgency score
        let urgencyScore = 0;
        if (need.urgency === "High") urgencyScore = 3;
        else if (need.urgency === "Medium") urgencyScore = 2;
        else urgencyScore = 1;

        // 🔥 Final score
        const score =
          (skillScore * 5) +
          (locationScore * 3) +
          (urgencyScore * 2);

        return { ...v, score };
      })
      .sort((a, b) => b.score - a.score);
  };

  // AI explanation generation
  useEffect(() => {
    const generateAllExplanations = async () => {
      const newExplanations = {};

      for (const need of needs) {
        const matches = getMatches(need);
        if (matches.length > 0) {
          const text = await generateMatchExplanation(need, matches[0]);
          newExplanations[need.id] = text;
        }
      }

      setExplanations(newExplanations);
    };

    if (needs.length && volunteers.length) {
      generateAllExplanations();
    }
  }, [needs, volunteers]);

  const getUrgencyClass = (urgency) => {
    switch (urgency) {
      case "High":
        return "urgency-high";
      case "Medium":
        return "urgency-medium";
      case "Low":
        return "urgency-low";
      default:
        return "urgency-default";
    }
  };

  return (
    <div className="dashboard-wrapper animate-fade-in">
      <div className="dashboard-header">
        <h2 className="dashboard-title">AI Suggested Matches</h2>
        <div className="glass-card live-indicator">
          <div className="pulse-dot"></div>
          Live Updates
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center" }}>Loading needs...</p>
      ) : needs.length === 0 ? (
        <p style={{ textAlign: "center" }}>
          No needs found in your community yet.
        </p>
      ) : (
        <div className="cards-grid">
          {needs.map((item) => {
            const matches = getMatches(item).slice(0, 3);
            const validMatches = matches.filter(v => v.score > 0);

            return (
              <div key={item.id} className="glass-card need-card">

                <div className="card-header">
                  <h3 className="card-title">{item.title}</h3>
                  <span className={`urgency-badge ${getUrgencyClass(item.urgency)}`}>
                    <AlertCircle size={12} />
                    {item.urgency}
                  </span>
                </div>

                <p className="card-description">{item.description}</p>

                <div className="card-footer">
                  <MapPin size={16} />
                  {item.location}
                </div>

                <div style={{
                  marginTop: "12px",
                  fontSize: "13px",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: "8px",
                }}>
                  <strong>Suggested Volunteers:</strong>

                  {validMatches.length === 0 ? (
                    <p style={{ color: "#999" }}>
                      No suitable match found
                    </p>
                  ) : (
                    <>
                      <p style={{ color: "#22c55e", fontWeight: "bold" }}>
                        ⭐ Best Match: {validMatches[0].name}
                      </p>

                      <p style={{ fontSize: "12px", color: "#aaa" }}>
                        {explanations[item.id] || "Analyzing..."}
                      </p>

                      {validMatches.map((v) => (
                        <p key={v.id}>
                          {v.name} (Score: {Math.round(v.score)})
                        </p>
                      ))}
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}