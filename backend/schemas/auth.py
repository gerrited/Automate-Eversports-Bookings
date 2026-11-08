from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    avatar_url: str | None = None


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
