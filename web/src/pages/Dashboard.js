import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

function Dashboard() {
  const { token, logout } = useAuth();
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    async function fetchJobs() {
      // Mock fetch jobs
      setJobs([{ id: "1", name: "Test Job", status: "pending" }]);
    }
    fetchJobs();
  }, []);

  return (
    <div className="dashboard">
      <h2>Job Dashboard</h2>
      <button onClick={logout}>Logout</button>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{job.id}</td>
              <td>{job.name}</td>
              <td>{job.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;