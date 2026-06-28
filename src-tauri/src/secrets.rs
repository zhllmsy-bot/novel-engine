use keyring::{Entry, Error as KeyringError};
use thiserror::Error;

const PROVIDER_KEY_SERVICE: &str = "org.novelengine.desktop.provider";

#[derive(Debug, Error)]
pub enum SecretError {
    #[error("credential store error: {0}")]
    Keyring(#[from] KeyringError),
}

pub fn get_provider_api_key(provider_id: &str) -> Result<Option<String>, SecretError> {
    let entry = provider_entry(provider_id)?;

    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub fn set_provider_api_key(provider_id: &str, api_key: &str) -> Result<(), SecretError> {
    provider_entry(provider_id)?.set_password(api_key)?;
    Ok(())
}

pub fn delete_provider_api_key(provider_id: &str) -> Result<(), SecretError> {
    let entry = provider_entry(provider_id)?;

    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn provider_entry(provider_id: &str) -> Result<Entry, SecretError> {
    Ok(Entry::new(PROVIDER_KEY_SERVICE, provider_id)?)
}
