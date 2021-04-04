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

  cliptube_has() {
    type "$1" > /dev/null 2>&1
  }

  cliptube_echo() {
    command printf %s\\n "$*" 2>/dev/null
  }

  cliptube_install_dir() {
    [ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.cliptube/bin" || printf %s "${XDG_CONFIG_HOME}/cliptube/bin"
  }

  cliptube_profile_is_bash_or_zsh() {
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

  cliptube_try_profile() {
    if [ -z "${1-}" ] || [ ! -f "${1}" ]; then
      return 1
    fi
    cliptube_echo "${1}"
  }

  # Detect profile file if not specified as environment variable
  # (eg: PROFILE=~/.myprofile)
  # The echo'ed path is guaranteed to be an existing file
  # Otherwise, an empty string is returned
  cliptube_detect_profile() {
    if [ "${PROFILE-}" = '/dev/null' ]; then
      # the user has specifically requested NOT to have cliptube touch their profile
      return
    fi

    if [ -n "${PROFILE}" ] && [ -f "${PROFILE}" ]; then
      cliptube_echo "${PROFILE}"
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
        if DETECTED_PROFILE="$(cliptube_try_profile "${HOME}/${EACH_PROFILE}")"; then
          break
        fi
      done
    fi

    if [ -n "$DETECTED_PROFILE" ]; then
      cliptube_echo "$DETECTED_PROFILE"
    fi
  }

  cliptube_download() {
    if cliptube_has "curl"; then
      curl --fail --compressed -q "$@"
    elif cliptube_has "wget"; then
      # Emulate curl with wget
      ARGS=$(cliptube_echo "$@" | command sed -e 's/--progress-bar /--progress=bar /' \
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

  cliptube_arch() {
    printf %s 'macos-x64'
  }

  cliptube_install_source() {
    cliptube_download -s https://api.github.com/repos/andrewbranch/cliptube/releases/latest \
      | grep "tag_name" \
      | awk "{print \"https://github.com/andrewbranch/cliptube/archive/\" substr(\$2, 2, length(\$2)-3) \"/cliptube-$(cliptube_arch)\"}"
  }

  cliptube_install() {
    if cliptube_has curl || cliptube_has wget; then
      local INSTALL_DIR
      INSTALL_DIR="$(cliptube_install_dir)"
      local INSTALL_SOURCE
      INSTALL_SOURCE="$(cliptube_install_source)"
      mkdir -p "$INSTALL_DIR"
      if [ -f "$INSTALL_DIR/cliptube" ]; then
        cliptube_echo "=> cliptube is already installed in $INSTALL_DIR; downloading potential update"
      else
        cliptube_echo "=> Downloading cliptube to '$INSTALL_DIR'"
      fi
      cliptube_download -s "$INSTALL_SOURCE" -o "$INSTALL_DIR/cliptube" || {
        cliptube_echo >&2 "Failed to download '$INSTALL_SOURCE'"
        return 1
      }
      chmod a+x "$INSTALL_DIR/cliptube" || {
        cliptube_echo >&2 "Failed to mark '$INSTALL_DIR/cliptube' as executable"
        return 2
      }

      local CLIPTUBE_PROFILE
      CLIPTUBE_PROFILE="$(cliptube_detect_profile)"
      local PROFILE_INSTALL_DIR
      PROFILE_INSTALL_DIR="$(cliptube_install_dir | command sed "s:^$HOME:\$HOME:")"
      SOURCE_STR="\\n# Add cliptube to \$PATH\\nexport PATH=\"${PROFILE_INSTALL_DIR}:\$PATH\"\\n"

      if [ -z "${CLIPTUBE_PROFILE-}" ] ; then
        local TRIED_PROFILE
        if [ -n "${PROFILE}" ]; then
          TRIED_PROFILE="${CLIPTUBE_PROFILE} (as defined in \$PROFILE), "
        fi
        cliptube_echo "=> Profile not found. Tried ${TRIED_PROFILE-}~/.bashrc, ~/.bash_profile, ~/.zshrc, and ~/.profile."
        cliptube_echo "=> Create one of them and run this script again"
        cliptube_echo "   OR"
        cliptube_echo "=> Append the following lines to the correct file yourself:"
        command printf "${SOURCE_STR}"
        cliptube_echo
      else
        if cliptube_profile_is_bash_or_zsh "${CLIPTUBE_PROFILE-}"; then
          BASH_OR_ZSH=true
        fi
        if ! command grep -qc 'cliptube/bin' "$CLIPTUBE_PROFILE"; then
          cliptube_echo "=> Appending cliptube source string to $CLIPTUBE_PROFILE"
          command printf "${SOURCE_STR}" >> "$CLIPTUBE_PROFILE"
        else
          cliptube_echo "=> cliptube source string already in ${CLIPTUBE_PROFILE}"
        fi
      fi

      cliptube_echo "=> Successfully installed cliptube. Close and reopen your terminal or run the following:"
      cliptube_echo ""
      cliptube_echo "export PATH=\"${PROFILE_INSTALL_DIR}:\$PATH\""
      cliptube_reset
    else
      cliptube_echo >&2 'You need curl or wget to install cliptube'
      exit 1
    fi
  }

  cliptube_reset() {
    unset -f \
      cliptube_has \
      cliptube_echo \
      cliptube_install_dir \
      cliptube_profile_is_bash_or_zsh \
      cliptube_try_profile \
      cliptube_detect_profile \
      cliptube_download \
      cliptube_install \
      cliptube_reset
  }

  cliptube_install
}
