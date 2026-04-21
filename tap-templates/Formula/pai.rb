# frozen_string_literal: true

class Pai < Formula
  desc "Flash, verify, and try PAI — private offline AI on a bootable USB"
  homepage "https://pai.direct"
  url "https://github.com/nirholas/pai/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "GPL-3.0-or-later"
  version "0.2.0"

  depends_on "qemu" => :optional
  depends_on "coreutils" => :recommended

  def install
    bin.install "scripts/pai"
    (libexec/"pai").install "scripts/flash.sh"
    (libexec/"pai").install "scripts/try.sh" if File.exist?("scripts/try.sh")
    inreplace bin/"pai", "__LIBEXEC__", libexec/"pai"
  end

  test do
    assert_match "pai CLI version", shell_output("#{bin}/pai version 2>&1", 0)
    assert_match "Usage", shell_output("#{bin}/pai help")
    assert_match "flash", shell_output("#{bin}/pai help")
  end
end
