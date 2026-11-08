from pydantic import BaseModel


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnsubscribeRequest(BaseModel):
    endpoint: str
