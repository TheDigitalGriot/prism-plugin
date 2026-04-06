import { MAC } from "../../theme/colors";

const MIT_LICENSE = `MIT License

Copyright (c) 2026 TheDigitalGriot

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

export function LicenseStep() {
  return (
    <div
      style={{
        flex: 1,
        padding: "20px 28px 0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          color: MAC.white,
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Software License Agreement
      </div>
      <div
        style={{
          flex: 1,
          maxHeight: 220,
          overflowY: "auto",
          background: MAC.panel,
          border: `1px solid ${MAC.border}`,
          borderRadius: 8,
          padding: "14px 16px",
          color: MAC.muted,
          fontSize: 11,
          lineHeight: 1.7,
          marginBottom: 14,
          fontFamily: "Monaco, Menlo, monospace",
          whiteSpace: "pre-wrap",
        }}
      >
        {MIT_LICENSE}
      </div>
      <div
        style={{
          padding: "12px 14px",
          background: MAC.panel,
          border: `1px solid ${MAC.border}`,
          borderRadius: 8,
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span style={{ color: MAC.muted, fontSize: 11, lineHeight: 1.5 }}>
          To continue installing the software you must agree to the terms of
          the software license agreement. Click "Agree" to continue or
          "Disagree" to cancel the installation and quit the Installer.
        </span>
      </div>
    </div>
  );
}
