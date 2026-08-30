from pydantic import BaseModel, Field


class EnqueueSmsRequest(BaseModel):
    phoneNumber: str = Field(min_length=8, max_length=20)
    message: str = Field(min_length=1, max_length=500)
    source: str | None = Field(default=None, max_length=100)


class SmsResultRequest(BaseModel):
    success: bool
    errorMessage: str | None = Field(default=None, max_length=1000)


class PendingSmsResponse(BaseModel):
    id: str
    phoneNumber: str
    message: str


class EnqueueSmsResponse(BaseModel):
    id: str
    status: str
