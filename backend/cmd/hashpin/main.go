package main

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	pins := []string{"0123", "1234", "2345", "3456"}

	for _, pin := range pins {
		hash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Hashing %q failed: %v", pin, err)
		}
		fmt.Println(pin, string(hash))
	}
}
