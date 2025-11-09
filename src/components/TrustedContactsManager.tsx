import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit2, UserPlus, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { TrustedContact, getData, saveTrustedContacts } from '@/utils/storage';
import ContactsCSVImport from './ContactsCSVImport';

const TrustedContactsManager = () => {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [newContact, setNewContact] = useState<TrustedContact>({ name: '', email: '' });
  const [editingContact, setEditingContact] = useState<TrustedContact | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    // Load initial contacts from storage
    const loadContacts = async () => {
      try {
        const data = await getData();
        setContacts(data.trustedContacts || []);
      } catch (error) {
        console.error('Error loading trusted contacts:', error);
        toast({
          title: 'Error',
          description: 'Failed to load trusted contacts',
          variant: 'destructive'
        });
      }
    };

    loadContacts();
  }, [toast]);

  const handleSaveContacts = async (updatedContacts: TrustedContact[]) => {
    try {
      await saveTrustedContacts(updatedContacts);
      setContacts(updatedContacts);
      toast({
        title: 'Success',
        description: 'Trusted contacts updated successfully',
      });
    } catch (error) {
      console.error('Error saving trusted contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to save trusted contacts',
        variant: 'destructive'
      });
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.email.trim()) {
      toast({
        title: 'Error',
        description: 'Name and email are required',
        variant: 'destructive'
      });
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newContact.email)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }

    // Check for duplicates
    if (contacts.some(contact => contact.email.toLowerCase() === newContact.email.toLowerCase())) {
      toast({
        title: 'Error',
        description: 'A contact with this email already exists',
        variant: 'destructive'
      });
      return;
    }

    const updatedContacts = [...contacts, newContact];
    await handleSaveContacts(updatedContacts);
    setNewContact({ name: '', email: '' });
    setIsAddDialogOpen(false);
  };

  const handleEditClick = (contact: TrustedContact, index: number) => {
    setEditingContact({ ...contact });
    setEditingIndex(index);
    setIsEditDialogOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact || editingIndex === -1) return;

    if (!editingContact.name.trim() || !editingContact.email.trim()) {
      toast({
        title: 'Error',
        description: 'Name and email are required',
        variant: 'destructive'
      });
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editingContact.email)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }

    // Check for duplicates (excluding the current contact)
    if (contacts.some((contact, idx) => 
      idx !== editingIndex && contact.email.toLowerCase() === editingContact.email.toLowerCase()
    )) {
      toast({
        title: 'Error',
        description: 'A contact with this email already exists',
        variant: 'destructive'
      });
      return;
    }

    const updatedContacts = [...contacts];
    updatedContacts[editingIndex] = editingContact;
    await handleSaveContacts(updatedContacts);
    setEditingContact(null);
    setEditingIndex(-1);
    setIsEditDialogOpen(false);
  };

  const handleDeleteContact = async (index: number) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      const updatedContacts = contacts.filter((_, idx) => idx !== index);
      await handleSaveContacts(updatedContacts);
    }
  };

  const handleContactsImport = async (newContacts: TrustedContact[], replaceAll: boolean = false) => {
    if (replaceAll) {
      // Replace all contacts
      await handleSaveContacts(newContacts);
      setSelectedContacts(new Set()); // Clear selection
    } else {
      // Append new contacts
      const updatedContacts = [...contacts, ...newContacts];
      await handleSaveContacts(updatedContacts);
    }
  };

  const handleToggleContactSelection = (email: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(email)) {
      newSelection.delete(email);
    } else {
      newSelection.add(email);
    }
    setSelectedContacts(newSelection);
  };

  const handleSelectAllContacts = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(new Set(contacts.map(c => c.email)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleDeleteSelectedContacts = async () => {
    if (selectedContacts.size === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)?`)) {
      return;
    }

    const remainingContacts = contacts.filter(c => !selectedContacts.has(c.email));
    await handleSaveContacts(remainingContacts);
    setSelectedContacts(new Set());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5 text-[#4B2EE3]" />
          Trusted Contacts
        </CardTitle>
        <CardDescription>
          Add contacts you trust to detect email spoofing attempts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">
              {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'}
            </h4>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Trusted Contact</DialogTitle>
                  <DialogDescription>
                    Add a new contact to your trusted list.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      placeholder="john.doe@example.com"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddContact}>
                    Add Contact
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No trusted contacts added yet
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedContacts.size === contacts.length && contacts.length > 0}
                    onCheckedChange={handleSelectAllContacts}
                  />
                  <span className="text-sm font-medium">
                    Select All ({selectedContacts.size} of {contacts.length})
                  </span>
                </div>
                {selectedContacts.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelectedContacts}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedContacts.size})
                  </Button>
                )}
              </div>
              <div className="border rounded-md">
                {contacts.map((contact, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={selectedContacts.has(contact.email)}
                        onCheckedChange={() => handleToggleContactSelection(contact.email)}
                      />
                      <div>
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm text-gray-500">{contact.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(contact, index)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteContact(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mt-2">
            Vervain will alert you if someone uses a trusted contact's name but with a different email address.
          </p>
        </div>
      </CardContent>

      {/* CSV Import Manager for Contacts */}
      <div className="mt-6">
        <ContactsCSVImport
          onContactsImport={handleContactsImport}
          existingContacts={contacts}
        />
      </div>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trusted Contact</DialogTitle>
            <DialogDescription>
              Modify the details of an existing trusted contact.
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={editingContact.email}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateContact}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TrustedContactsManager; 