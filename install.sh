#!/usr/bin/env sh

# Adapted from https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh. Original nvm license:

# The MIT License (MIT)
# 
# Copyright (c) 2010 Tim Caswell
# 
# Copyright (c) 2014 Jordan Harband
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
# associated documentation files (the "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all copies or substantial
# portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
# LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
# NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
# WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

{

  splyt_has() {
    type "$1" > /dev/null 2>&1
  }

  splyt_echo() {
    command printf %s\\n "$*" 2>/dev/null
  }

  splyt_install_dir() {
    [ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.splyt/bin" || printf %s "${XDG_CONFIG_HOME}/splyt/bin"
  }

  splyt_profile_is_bash_or_zsh() {
    local TEST_PROFILE
    TEST_PROFILE="${1-}"
    case "${TEST_PROFILE-}" in
      *"/.bashrc" | *"/.bash_profile" | *"/.zshrc")
        return
      ;;
      *)
        return 1
      ;;
    esac
  }

  splyt_try_profile() {
    if [ -z "${1-}" ] || [ ! -f "${1}" ]; then
      return 1
    fi
    splyt_echo "${1}"
  }

  # Detect profile file if not specified as environment variable
  # (eg: PROFILE=~/.myprofile)
  # The echo'ed path is guaranteed to be an existing file
  # Otherwise, an empty string is returned
  splyt_detect_profile() {
    if [ "${PROFILE-}" = '/dev/null' ]; then
      # the user has specifically requested NOT to have splyt touch their profile
      return
    fi

    if [ -n "${PROFILE}" ] && [ -f "${PROFILE}" ]; then
      splyt_echo "${PROFILE}"
      return
    fi

    local DETECTED_PROFILE
    DETECTED_PROFILE=''

    if [ -n "${ZSH_VERSION-}" ] || [[ "$SHELL" == */zsh ]]; then
      DETECTED_PROFILE="$HOME/.zshrc"
    elif [ -n "${BASH_VERSION-}" ]; then
      if [ -f "$HOME/.bashrc" ]; then
        DETECTED_PROFILE="$HOME/.bashrc"
      elif [ -f "$HOME/.bash_profile" ]; then
        DETECTED_PROFILE="$HOME/.bash_profile"
      fi
    fi

    if [ -z "$DETECTED_PROFILE" ]; then
      for EACH_PROFILE in ".profile" ".bashrc" ".bash_profile" ".zshrc"
      do
        if DETECTED_PROFILE="$(splyt_try_profile "${HOME}/${EACH_PROFILE}")"; then
          break
        fi
      done
    fi

    if [ -n "$DETECTED_PROFILE" ]; then
      splyt_echo "$DETECTED_PROFILE"
    fi
  }

  splyt_download() {
    if splyt_has "curl"; then
      curl --fail --compressed -q "$@"
    elif splyt_has "wget"; then
      # Emulate curl with wget
      ARGS=$(splyt_echo "$@" | command sed -e 's/--progress-bar /--progress=bar /' \
                              -e 's/--compressed //' \
                              -e 's/--fail //' \
                              -e 's/-L //' \
                              -e 's/-I /--server-response /' \
                              -e 's/-s /-q /' \
                              -e 's/-sS /-nv /' \
                              -e 's/-o /-O /' \
                              -e 's/-C - /-c /')
      eval wget $ARGS
    fi
  }

  splyt_install() {
    if splyt_has curl || splyt_has wget; then
      local INSTALL_DIR
      INSTALL_DIR="$(splyt_install_dir)"
      local INSTALL_SOURCE
      INSTALL_SOURCE='https://atcb.blob.core.windows.net/splyt/latest'
      mkdir -p "$INSTALL_DIR"
      if [ -f "$INSTALL_DIR/splyt" ]; then
        splyt_echo "=> splyt is already installed in $INSTALL_DIR; downloading potential update"
      else
        splyt_echo "=> Downloading splyt to '$INSTALL_DIR'"
      fi
      splyt_download -s "$INSTALL_SOURCE" -o "$INSTALL_DIR/splyt" || {
        splyt_echo >&2 "Failed to download '$INSTALL_SOURCE'"
        return 1
      }
      chmod a+x "$INSTALL_DIR/splyt" || {
        splyt_echo >&2 "Failed to mark '$INSTALL_DIR/splyt' as executable"
        return 2
      }

      local SPLYT_PROFILE
      SPLYT_PROFILE="$(splyt_detect_profile)"
      local PROFILE_INSTALL_DIR
      PROFILE_INSTALL_DIR="$(splyt_install_dir | command sed "s:^$HOME:\$HOME:")"
      SOURCE_STR="\\n# Add splyt to \$PATH\\nexport PATH=\"${PROFILE_INSTALL_DIR}:\$PATH\"\\n"

      if [ -z "${SPLYT_PROFILE-}" ] ; then
        local TRIED_PROFILE
        if [ -n "${PROFILE}" ]; then
          TRIED_PROFILE="${SPLYT_PROFILE} (as defined in \$PROFILE), "
        fi
        splyt_echo "=> Profile not found. Tried ${TRIED_PROFILE-}~/.bashrc, ~/.bash_profile, ~/.zshrc, and ~/.profile."
        splyt_echo "=> Create one of them and run this script again"
        splyt_echo "   OR"
        splyt_echo "=> Append the following lines to the correct file yourself:"
        command printf "${SOURCE_STR}"
        splyt_echo
      else
        if splyt_profile_is_bash_or_zsh "${SPLYT_PROFILE-}"; then
          BASH_OR_ZSH=true
        fi
        if ! command grep -qc 'splyt/bin' "$SPLYT_PROFILE"; then
          splyt_echo "=> Appending splyt source string to $SPLYT_PROFILE"
          command printf "${SOURCE_STR}" >> "$SPLYT_PROFILE"
        else
          splyt_echo "=> splyt source string already in ${SPLYT_PROFILE}"
        fi
      fi

      splyt_echo "=> Successfully installed splyt. Close and reopen your terminal or run the following:"
      splyt_echo ""
      splyt_echo "export PATH=\"${PROFILE_INSTALL_DIR}:\$PATH\""
      splyt_reset
    else
      splyt_echo >&2 'You need curl or wget to install splyt'
      exit 1
    fi
  }

  splyt_reset() {
    unset -f \
      splyt_has \
      splyt_echo \
      splyt_install_dir \
      splyt_profile_is_bash_or_zsh \
      splyt_try_profile \
      splyt_detect_profile \
      splyt_download \
      splyt_install \
      splyt_reset
  }

  splyt_install
}
