from hashlib import pbkdf2_hmac
from hmac import compare_digest
from secrets import token_hex


def hash_password(password: str) -> str:
    salt = token_hex(16)
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    salt, digest = password_hash.split("$", maxsplit=1)
    candidate = pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000).hex()
    return compare_digest(candidate, digest)
