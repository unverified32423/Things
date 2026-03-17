from flask import Flask, redirect, request, session, jsonify
from flask_session import Session
import requests
import os
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "changeme")
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

DISCORD_CLIENT_ID     = os.getenv("1469829028176461834")
DISCORD_CLIENT_SECRET = os.getenv("FSm_dqMLT86NAP90hiPJm4JfqLOSy_Qs")
DISCORD_BOT_TOKEN     = os.getenv("MTQ2OTgyOTAyODE3NjQ2MTgzNA.GVIQGu.N8zsNHh7NpY_Fyloh4_zYL3WPSlXJ7WpZetsLo")
DISCORD_GUILD_ID      = os.getenv("1483509835407425729")
DISCORD_CLIENT_ROLE   = os.getenv("1483509872854306887")
REDIRECT_URI          = os.getenv("REDIRECT_URI", "http://localhost:5000/callback")
FRONTEND_URL          = os.getenv("FRONTEND_URL", "http://localhost:5500")

DISCORD_API = "https://discord.com/api/v10"

@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"]      = FRONTEND_URL
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"]     = "Content-Type"
    return response

@app.route("/login")
def login():
    url = (
        "https://discord.com/oauth2/authorize"
        f"?client_id={DISCORD_CLIENT_ID}"
        f"&redirect_uri={quote(REDIRECT_URI, safe='')}"
        "&response_type=code"
        "&scope=identify+guilds.members.read"
    )
    return redirect(url)

@app.route("/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return redirect(f"{FRONTEND_URL}?error=no_code")

    token_res = requests.post(f"{DISCORD_API}/oauth2/token", data={
        "client_id":     DISCORD_CLIENT_ID,
        "client_secret": DISCORD_CLIENT_SECRET,
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  REDIRECT_URI,
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})

    token_data = token_res.json()
    access_token = token_data.get("access_token")
    if not access_token:
        return redirect(f"{FRONTEND_URL}?error=token_failed")

    user = requests.get(f"{DISCORD_API}/users/@me", headers={
        "Authorization": f"Bearer {access_token}"
    }).json()
    user_id = user.get("id")

    member = requests.get(
        f"{DISCORD_API}/guilds/{DISCORD_GUILD_ID}/members/{user_id}",
        headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
    ).json()

    has_role = DISCORD_CLIENT_ROLE in member.get("roles", [])

    session["user"] = {
        "id":        user_id,
        "username":  user.get("username"),
        "avatar":    user.get("avatar"),
        "is_client": has_role,
    }

    return redirect(f"{FRONTEND_URL}/client" if has_role else f"{FRONTEND_URL}?error=no_access")

@app.route("/me")
def me():
    user = session.get("user")
    if not user:
        return jsonify({"logged_in": False}), 401
    return jsonify({"logged_in": True, "user": user})

@app.route("/logout")
def logout():
    session.clear()
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
