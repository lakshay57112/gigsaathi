"""Languages the assistant can reply in, plus reference lists used by forms."""

from typing import NamedTuple


class Language(NamedTuple):
    name: str  # English name, used in AI prompts
    native: str  # shown in the language picker
    speech_locale: str  # BCP-47 tag for browser speech recognition


LANGUAGES: dict[str, Language] = {
    "en": Language("English", "English", "en-IN"),
    "hi": Language("Hindi", "हिन्दी", "hi-IN"),
    "bn": Language("Bengali", "বাংলা", "bn-IN"),
    "mr": Language("Marathi", "मराठी", "mr-IN"),
    "te": Language("Telugu", "తెలుగు", "te-IN"),
    "ta": Language("Tamil", "தமிழ்", "ta-IN"),
    "gu": Language("Gujarati", "ગુજરાતી", "gu-IN"),
    "kn": Language("Kannada", "ಕನ್ನಡ", "kn-IN"),
    "ml": Language("Malayalam", "മലയാളം", "ml-IN"),
    "pa": Language("Punjabi", "ਪੰਜਾਬੀ", "pa-IN"),
    "or": Language("Odia", "ଓଡ଼ିଆ", "or-IN"),
    "ur": Language("Urdu", "اردو", "ur-IN"),
    "as": Language("Assamese", "অসমীয়া", "as-IN"),
}

OCCUPATIONS: dict[str, str] = {
    "delivery_partner": "Delivery partner (food, grocery, parcel)",
    "driver": "Driver (cab, auto, taxi, truck)",
    "daily_wage": "Daily-wage worker (construction, loading, farm labour)",
    "domestic_worker": "Domestic worker or home-based worker",
    "street_vendor": "Street vendor or small trader",
    "other_unorganised": "Other informal work",
}

STATES: list[str] = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry",
]  # fmt: skip
