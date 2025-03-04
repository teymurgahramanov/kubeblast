import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";
import { TextField, Button, Typography, Container, Alert, MenuItem, Select, FormControl, InputLabel, Box } from "@mui/material";

const AddForm = ({ currentUser = {}, onAddJob }) => {
    // const [name, setName] = useState('');
    // const [owner, setOwner] = useState(currentUser?.username || '');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            setMsg("Please select a file.");
            return;
        }

        const formData = new FormData();
        // formData.append("name", name);
        // formData.append("owner", owner);
        formData.append("description", description);

        formData.append("file", file);

        try {
            const response = await axiosInstance.post("/jobs", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            onAddJob(response.data);  // Pass the new job data back to parent
            navigate("/jobs");
        } catch (error) {
            setMsg(error.response?.data?.msg || "An error occurred while saving.");
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "#14213D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Container maxWidth="sm" sx={{ backgroundColor: "#fff", padding: 4, borderRadius: 2, boxShadow: 3 }}>
                <Typography variant="h4" align="center" gutterBottom>
                    Add New Job
                </Typography>
                {msg && <Alert severity="error">{msg}</Alert>}
                <form onSubmit={handleSubmit}>
          

                    <TextField
                        label="Description"
                        variant="outlined"
                        multiline
                        rows={3}
                        fullWidth
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        sx={{ mb: 2 }}
                    />



                    <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        style={{ marginTop: 10 }}
                    />
                    {file && <Typography variant="body2" sx={{ mt: 1 }}>Selected File: {file.name}</Typography>}

                    <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
                        Save
                    </Button>
                </form>
            </Container>
        </Box>
    );
};

export default AddForm;
