# Copyright (c) PROPHESSOR 2019-2020

class ByteTools():
    def __init__(self, stream):
        self.stream = stream
        self.order = 'little'

    def byteorder(self, order=None):
        if not order:
            return self.order

        self.order = order

    def parseASCIIString(self, length):
        return self.stream.read(length).decode('ascii')

    def parseUnicodeString(self, length):
        return self.stream.read(length).decode('utf-8')

    def parseString(self, length): return self.parseUnicodeString(length)

    def _checkEOF(self, x):
        bytes = self.stream.read(x)

        if not bytes: raise IOError("Unexpected end of file")

        return bytes

    def parseUInt(self, x):
        return int.from_bytes(self._checkEOF(x), byteorder=self.order, signed=False)

    def parseUInt8(self):  return self.parseUInt(1)
    def parseUInt16(self): return self.parseUInt(2)
    def parseUInt32(self): return self.parseUInt(4)

    def parseInt(self, x):
        return int.from_bytes(self._checkEOF(x), byteorder=self.order, signed=True)

    def parseInt8(self):  return self.parseInt(1)
    def parseInt16(self): return self.parseInt(2)
    def parseInt32(self): return self.parseInt(4)
    def parseInt64(self): return self.parseInt(8)