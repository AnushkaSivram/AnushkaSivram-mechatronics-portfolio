import React from "react";

export default function Panel({ children, accent }) {
  return (
    <div className="panel" style={{ ["--accent"]: accent }}>
      {children}
    </div>
  );
}
