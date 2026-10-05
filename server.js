const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
    session({
        secret: "todo-app-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);

app.use(express.static("public"));

// ==================== REGISTER ====================

app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Please enter username and password"
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (username, password) VALUES (?, ?)`,
            [username, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes("UNIQUE")) {
                        return res.status(400).json({
                            error: "Username already exists"
                        });
                    }

                    return res.status(500).json({
                        error: "Server error"
                    });
                }

                res.json({
                    message: "Registration successful"
                });
            }
        );
    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});

// ==================== LOGIN ====================

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Please enter username and password"
        });
    }

    db.get(
        `SELECT * FROM users WHERE username = ?`,
        [username],
        async (err, user) => {
            if (err) {
                return res.status(500).json({
                    error: "Server error"
                });
            }

            if (!user) {
                return res.status(401).json({
                    error: "Invalid username or password"
                });
            }

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    error: "Invalid username or password"
                });
            }

            req.session.userId = user.id;
            req.session.username = user.username;

            res.json({
                message: "Login successful",
                username: user.username
            });
        }
    );
});

// ==================== CHECK LOGIN ====================

app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Not logged in"
        });
    }

    res.json({
        username: req.session.username
    });
});

// ==================== GET TODOS ====================

app.get("/api/todos", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Not logged in"
        });
    }

    db.all(
        `SELECT id, task FROM todos WHERE user_id = ? ORDER BY id DESC`,
        [req.session.userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({
                    error: "Server error"
                });
            }

            res.json(rows);
        }
    );
});

// ==================== ADD TODO ====================

app.post("/api/todos", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Not logged in"
        });
    }

    const { task } = req.body;

    if (!task || !task.trim()) {
        return res.status(400).json({
            error: "Please enter a task"
        });
    }

    db.run(
        `INSERT INTO todos (user_id, task) VALUES (?, ?)`,
        [req.session.userId, task.trim()],
        function (err) {
            if (err) {
                return res.status(500).json({
                    error: "Server error"
                });
            }

            res.json({
                message: "Task added",
                id: this.lastID,
                task: task.trim()
            });
        }
    );
});

// ==================== DELETE TODO ====================

app.delete("/api/todos/:id", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Not logged in"
        });
    }

    db.run(
        `DELETE FROM todos WHERE id = ? AND user_id = ?`,
        [req.params.id, req.session.userId],
        function (err) {
            if (err) {
                return res.status(500).json({
                    error: "Server error"
                });
            }

            res.json({
                message: "Task deleted"
            });
        }
    );
});

// ==================== LOGOUT ====================

app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                error: "Logout failed"
            });
        }

        res.json({
            message: "Logged out"
        });
    });
});

// ==================== START SERVER ====================

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;