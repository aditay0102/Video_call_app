import { Routes, Route } from "react-router-dom"; // Note: react-router-dom is standard for web
import Home from "./pages/Home";

function App() {
  return (
    <div>
      {/* Navigation or Header could go here */}
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </div>
  )
}

export default App;